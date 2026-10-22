--[[
  Train Sim Germany – Verbindung zur App (Coins, Züge, Strecken)

  Was das Skript macht:
    • meldet der App alle 30 Sekunden (und beim Betreten/Verlassen) Coins, Züge und Strecken der Spieler,
      aber nur, wenn sich etwas geändert hat
    • holt Käufe aus der App ab und verbucht sie im Spiel (Coins abziehen, Zug bzw. Strecke freischalten)
    • meldet den Server (Spieler, Plätze, Version) – für die Server-Seite der App und /GetServers, /GetOnline, /GetUser im Chat
    • meldet, was jeder Spieler gerade macht: Rolle (Team), Zug, Linie, Ziel, Bahnhof (siehe Activity.read) –
      daraus zeigt die App die Rollen je Server, die Züge und unter „Spieler“, wo jemand gerade ist
    • meldet beendete Fahrten für die Statistik (siehe „Fahrten melden“ unten). Ohne Meldung bleibt die Statistik bei 0.
    • private Server: meldet ID und Besitzer und setzt die Einstellungen aus der App um
        – „Nur Mitglieder des Server-Chats“: wer nicht im verbundenen App-Chat ist, wird freundlich abgewiesen
        – Begrüßung und Regeln des Server-Chats beim Betreten
        – Nachrichten aus dem Server-Chat der App erscheinen im Spiel-Chat (vorher von Roblox gefiltert)
      Dafür zusätzlich game/TSGAppChat.client.lua als LocalScript nach StarterPlayer → StarterPlayerScripts legen.

  Einrichten (einmalig):
    1. Dieses Skript als Script nach ServerScriptService legen.
    2. Game Settings → Security → „Allow HTTP Requests“ einschalten.
    3. Creator Dashboard → dein Spiel → Secrets: neues Secret „tsg_game_key“ mit demselben Wert wie GAME_API_KEY
       im Backend (z. B. eine lange Zufallszeichenkette). Als Domain die Adresse des Backends angeben
       (z. B. *.workers.dev). Der Schlüssel steht so nie im Spiel-Code.
    4. CONFIG.Backend unten muss die Adresse des Backends sein (wie in assets/js/config.js → api).
    5. Economy.read und Economy.apply an euer Spiel anpassen, falls Coins und Besitz anders gespeichert sind.
    6. Optional: Activity.read anpassen und Fahrten melden (siehe unten), damit Züge und Statistik in der App erscheinen.

  Fahrten melden (für die Statistik): Dieses Skript legt in ServerStorage das BindableEvent „TSGTripDone“ an.
  Euer Spiel ruft es am Ende einer Fahrt auf:
    game.ServerStorage:WaitForChild("TSGTripDone"):Fire(player, { route = "R001", vehicle = "talent2", km = 142, delay = 2 })
  route = Strecke (R001 …), vehicle = Zug-ID aus dem Shop, km = gefahrene Kilometer, delay = Verspätung am Ziel in Minuten.

  Die IDs der Züge und Strecken müssen mit dem Shop übereinstimmen (backend/shop.js → CATALOG):
    Züge: talent2, br481, flirt3, lint41, kiss, desirohc, dosto, ic2, ic1, ice-t, eu44, ice4
    Strecken: R001 … R010
]]

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local TextService = game:GetService("TextService")

local CONFIG = {
	Backend = "https://tsg-backend.lorismziray01.workers.dev",
	SecretName = "tsg_game_key",
	Interval = 30,
}

-- ===== Anpassen: so speichert euer Spiel Coins und Besitz =====
-- Standard: leaderstats.Coins (IntValue) und Ordner „OwnedTrains“ / „OwnedRoutes“ im Spieler mit je einem BoolValue pro ID.
local Economy = {}

local function ownedList(player, folderName)
	local out = {}
	local folder = player:FindFirstChild(folderName)
	if folder then
		for _, value in ipairs(folder:GetChildren()) do
			if value:IsA("BoolValue") and value.Value then
				table.insert(out, value.Name)
			end
		end
	end
	return out
end

function Economy.read(player)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	return {
		coins = coins and coins.Value or 0,
		trains = ownedList(player, "OwnedTrains"),
		routes = ownedList(player, "OwnedRoutes"),
	}
end

-- Kauf aus der App verbuchen. true = erledigt, false = abgelehnt (z. B. inzwischen zu wenig Coins)
function Economy.apply(player, purchase)
	local stats = player:FindFirstChild("leaderstats")
	local coins = stats and stats:FindFirstChild("Coins")
	if not coins then
		return false
	end
	local folderName = purchase.kind == "route" and "OwnedRoutes" or "OwnedTrains"
	local folder = player:FindFirstChild(folderName)
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = folderName
		folder.Parent = player
	end
	local owned = folder:FindFirstChild(purchase.item)
	if owned and owned.Value then
		return true -- gehört schon dem Spieler: nichts abziehen
	end
	if coins.Value < purchase.price then
		return false
	end
	coins.Value -= purchase.price
	if not owned then
		owned = Instance.new("BoolValue")
		owned.Name = purchase.item
		owned.Parent = folder
	end
	owned.Value = true
	return true
end

-- Was der Spieler gerade macht. Standard: Rolle = Name seines Teams (Passenger, Qualified Driver, Signaller, …),
-- alles andere aus Attributen, die euer Spiel am Spieler setzt, z. B. player:SetAttribute("TSG_Line", "RE 1"):
--   TSG_Line (Linie), TSG_Train (Zugnummer, z. B. „RE 3105“), TSG_Destination (Ziel), TSG_NextStop (nächster Halt),
--   TSG_Vehicle (Zug-ID aus dem Shop, z. B. „desirohc“), TSG_Station (Bahnhof, an dem er gerade arbeitet oder wartet)
local Activity = {}
function Activity.read(player)
	local function attr(name)
		local value = player:GetAttribute(name)
		if value == nil or value == "" then
			return nil
		end
		return tostring(value)
	end
	return {
		role = player.Team and player.Team.Name or nil,
		line = attr("TSG_Line"),
		train = attr("TSG_Train"),
		destination = attr("TSG_Destination"),
		nextStop = attr("TSG_NextStop"),
		vehicle = attr("TSG_Vehicle"),
		station = attr("TSG_Station"),
	}
end
-- ===== Ende Anpassen =====

local auth -- Secret mit „Bearer “ davor (wird nie ausgegeben)
local function authHeader()
	if not auth then
		local ok, secret = pcall(function()
			return HttpService:GetSecret(CONFIG.SecretName)
		end)
		if not ok then
			warn("[TSG] Secret „" .. CONFIG.SecretName .. "“ fehlt: " .. tostring(secret))
			return nil
		end
		auth = secret:AddPrefix("Bearer ")
	end
	return auth
end

local lastSent = {} -- userId → zuletzt gemeldeter Stand
local done = {} -- verbuchte Käufe für den nächsten Abgleich
local trips = {} -- beendete Fahrten für den nächsten Abgleich
local busy = false

-- Fahrten aus dem Spiel: ServerStorage.TSGTripDone:Fire(player, { route, vehicle, km, delay })
local tripDone = Instance.new("BindableEvent")
tripDone.Name = "TSGTripDone"
tripDone.Parent = ServerStorage
tripDone.Event:Connect(function(player, trip)
	if typeof(player) ~= "Instance" or not player:IsA("Player") or type(trip) ~= "table" then
		return
	end
	table.insert(trips, {
		userId = tostring(player.UserId),
		route = trip.route and tostring(trip.route) or nil,
		vehicle = trip.vehicle and tostring(trip.vehicle) or nil,
		cat = trip.cat and tostring(trip.cat) or nil,
		km = tonumber(trip.km) or 0,
		delay = tonumber(trip.delay) or 0,
	})
end)

local function activity(player)
	local ok, data = pcall(Activity.read, player)
	data = ok and type(data) == "table" and data or {}
	data.userId = tostring(player.UserId)
	data.name = player.Name
	data.displayName = player.DisplayName
	return data
end

local function snapshot(player)
	local ok, data = pcall(Economy.read, player)
	if not ok then
		warn("[TSG] Economy.read: " .. tostring(data))
		return nil
	end
	data.userId = tostring(player.UserId)
	return data
end

-- ===== Private Server: Einstellungen aus der App =====
local isPrivate = game.PrivateServerId ~= ""
local appConfig = nil -- kommt mit jedem Abgleich (siehe backend/pservers.js)
local relaySince = 0
local ownerName = nil

-- Nachrichten an die Spieler (LocalScript TSGAppChat.client.lua zeigt sie im Chat an)
local appMessage = Instance.new("RemoteEvent")
appMessage.Name = "TSGAppMessage"
appMessage.Parent = ReplicatedStorage

-- Text aus der App vor dem Anzeigen von Roblox filtern lassen (Pflicht für Texte von Spielern)
local function filtered(text, fromUserId)
	local ok, result = pcall(function()
		return TextService:FilterStringAsync(text, tonumber(fromUserId) or 0, Enum.TextFilterContext.PublicChat)
	end)
	if not ok then
		return nil
	end
	local ok2, out = pcall(function()
		return result:GetNonChatStringForBroadcastAsync()
	end)
	return ok2 and out or nil
end

local function allowed(player)
	if not appConfig or appConfig.access ~= "members" or not appConfig.allowed then
		return true
	end
	for _, id in ipairs(appConfig.allowed) do
		if tostring(id) == tostring(player.UserId) then
			return true
		end
	end
	return false
end

local function checkAccess(player)
	if not allowed(player) then
		player:Kick("Dieser private Server ist nur für Mitglieder des App-Chats „" .. tostring(appConfig.chat or appConfig.name) .. "“. Frag dort nach einer Einladung.")
		return false
	end
	return true
end

local function greet(player)
	if not appConfig then
		return
	end
	if appConfig.welcome ~= "" then
		local text = filtered(appConfig.welcome, appConfig.welcomeBy)
		if text then
			appMessage:FireClient(player, { kind = "welcome", text = text })
		end
	end
	if appConfig.rules and appConfig.rules ~= "" then
		local text = filtered(appConfig.rules, appConfig.welcomeBy)
		if text then
			appMessage:FireClient(player, { kind = "rules", text = text })
		end
	end
end

local function applyConfig(config)
	local first = appConfig == nil
	appConfig = config
	for _, player in ipairs(Players:GetPlayers()) do
		if checkAccess(player) and first then
			greet(player)
		end
	end
	-- Nachrichten aus dem Server-Chat der App
	for _, m in ipairs(config.relay or {}) do
		if m.at > relaySince then
			relaySince = m.at
			local text = filtered(m.text, m.by)
			if text then
				appMessage:FireAllClients({ kind = "chat", name = m.name, text = text })
			end
		end
	end
end

-- Dieser Server, für die Befehle im App-Chat und die privaten Server in der App
local function serverInfo(closing)
	local info = {
		jobId = game.JobId ~= "" and game.JobId or "studio",
		players = #Players:GetPlayers(),
		max = Players.MaxPlayers,
		version = game.PlaceVersion,
		private = isPrivate,
		closing = closing == true,
	}
	if isPrivate then
		info.privateId = game.PrivateServerId
		info.ownerId = tostring(game.PrivateServerOwnerId)
		if not ownerName and game.PrivateServerOwnerId ~= 0 then
			local ok, name = pcall(function()
				return Players:GetNameFromUserIdAsync(game.PrivateServerOwnerId)
			end)
			ownerName = ok and name or nil
		end
		info.ownerName = ownerName
		info.relaySince = relaySince
	end
	return info
end

local function sync(extra, closing)
	local header = authHeader()
	if not header then
		return
	end
	local players, online, doing = {}, {}, {}
	for _, player in ipairs(Players:GetPlayers()) do
		local id = tostring(player.UserId)
		table.insert(online, id)
		table.insert(doing, activity(player))
		local snap = snapshot(player)
		if snap then
			local encoded = HttpService:JSONEncode(snap)
			if lastSent[id] ~= encoded then
				table.insert(players, snap)
				lastSent[id] = encoded
			end
		end
	end
	for _, snap in ipairs(extra or {}) do
		table.insert(players, snap)
	end
	local sending = done
	done = {}
	local sendingTrips = trips
	trips = {}

	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = CONFIG.Backend .. "/api/game/sync",
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json", ["Authorization"] = header },
			Body = HttpService:JSONEncode({
				players = players,
				online = online,
				done = sending,
				server = serverInfo(closing),
				activity = doing,
				trips = sendingTrips,
			}),
		})
	end)
	if not ok or not res.Success then
		warn("[TSG] Abgleich fehlgeschlagen: " .. (ok and tostring(res.StatusCode) or tostring(res)))
		for _, d in ipairs(sending) do
			table.insert(done, d)
		end
		for _, trip in ipairs(sendingTrips) do
			table.insert(trips, trip)
		end
		for _, snap in ipairs(players) do
			lastSent[snap.userId] = nil
		end
		return
	end

	local body = HttpService:JSONDecode(res.Body)
	if body.config then
		applyConfig(body.config)
	end
	for userId, list in pairs(body.pending or {}) do
		local player = Players:GetPlayerByUserId(tonumber(userId))
		if player then
			for _, purchase in ipairs(list) do
				local okApply, applied = pcall(Economy.apply, player, purchase)
				if not okApply then
					warn("[TSG] Economy.apply: " .. tostring(applied))
				end
				table.insert(done, { id = purchase.id, userId = userId, ok = okApply and applied == true })
			end
			lastSent[userId] = nil -- neuen Stand gleich mitschicken
		end
	end
end

local function run()
	if busy then
		return
	end
	busy = true
	sync()
	if #done > 0 then
		sync() -- verbuchte Käufe sofort melden
	end
	busy = false
end

Players.PlayerAdded:Connect(function(player)
	if appConfig and not checkAccess(player) then
		return
	end
	task.wait(5) -- Spielstand laden lassen
	run()
	if appConfig and player.Parent then
		greet(player)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	local snap = snapshot(player)
	lastSent[tostring(player.UserId)] = nil
	if snap then
		task.spawn(sync, { snap })
	end
end)

game:BindToClose(function()
	sync(nil, true) -- Server meldet sich ab (Käufe werden trotzdem noch gemeldet)
end)

task.spawn(function()
	while true do
		task.wait(CONFIG.Interval)
		run()
	end
end)
