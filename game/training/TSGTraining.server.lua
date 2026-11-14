--[[
  Train Sim Germany – Trainings im Spiel (Server)

  Ablauf je Rang: 1. Anforderungen → 2. Theorie (Fragen zum nächsten Rang) → 3. Praktisch (Training aus der App).
  Einstellungen (Anforderungen, Fragen, Bestehensgrenze, Hauptschalter „Echtzeit“): ServerStorage.TSGTrainingKonfig
  Dazu gehört das LocalScript StarterGui.Menu.container.Training.TSGTraining.

  Echtzeit (K.Echtzeit = true):
  • Rang aus der Roblox-Gruppe (Kürzel in eckigen Klammern, „[QD] Qualified Driver“), nicht in der Gruppe = Guest.
  • XP aus player.playerStats.Erfahrung, Spielzeit zählt dieses Skript selbst.
  • Theorie: höchstens 10 Fragen, gewichtet, Bestehen ab 90 %. Nicht bestanden = genau 4 Tage gesperrt.
  • Warteschlange: Wer die Theorie besteht, bekommt eine Nummer (#1902). Jeder Server rechnet daraus dieselbe
    Zuteilung: kleinste Nummer → frühestes Training seines Rangs mit freiem Platz, jeder steht in genau einem Training.
  • Trainings, Leitung und Supervisors kommen aus der App (GET /api/content). „Join“ teleportiert in einen
    reservierten Server je Training (öffnet 15 Minuten vor Beginn).
  • Gespeichert im DataStore „TSG_Training_v1“, Warteschlange je Rang im OrderedDataStore „TSG_TrainingQueue_v1_<Rang>“.

  Simulation (K.Echtzeit = false): alles läuft nur im Speicher dieses Servers, nichts wird gelesen oder gespeichert.
  Start als Gast; XP, Spielzeit und Gruppe springen nach 10 Sekunden auf den nötigen Wert; Sperre 10 Sekunden;
  Beispiel-Trainings; „Join“ simuliert das Training und befördert nach 10 Sekunden in den nächsten Rang.
]]

local DataStoreService = game:GetService("DataStoreService")
local GroupService = game:GetService("GroupService")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local ServerStorage = game:GetService("ServerStorage")
local Teams = game:GetService("Teams")
local TeleportService = game:GetService("TeleportService")

local K = require(ServerStorage:WaitForChild("TSGTrainingKonfig"))
local ECHT = K.Echtzeit ~= false
local SIM_SEKUNDEN = 10 -- Simulation: so lange bis XP/Zeit/Gruppe erfüllt sind, Sperre, Training

-- ===== Verbindung zum Menü =====
local ordner = ReplicatedStorage:FindFirstChild("TSGTraining") or Instance.new("Folder")
ordner.Name = "TSGTraining"
local function remote(klasse, name)
	local r = ordner:FindFirstChild(name) or Instance.new(klasse)
	r.Name = name
	r.Parent = ordner
	return r
end
local rZustand = remote("RemoteFunction", "Zustand")
local rAbsenden = remote("RemoteFunction", "Absenden")
local rBeitreten = remote("RemoteFunction", "Beitreten")
ordner.Parent = ReplicatedStorage

-- ===== Speicher (nur Echtzeit) =====
local store, queueStore, serverStore
local online = ECHT and pcall(function()
	store = DataStoreService:GetDataStore("TSG_Training_v1")
	queueStore = DataStoreService:GetDataStore("TSG_TrainingQueue_v1")
	serverStore = DataStoreService:GetDataStore("TSG_TrainingServer_v1")
	store:GetAsync("_check")
end)
if ECHT then
	print("[TSG] Trainings: Echtzeit – " .. (online and "DataStore verbunden" or "ohne DataStore (nur im Speicher dieses Servers)"))
else
	warn("[TSG] Trainings: SIMULATION (K.Echtzeit = false) – nichts ist echt, nichts wird gespeichert. Vor dem Veröffentlichen auf true!")
end
local function ordered(ziel)
	return DataStoreService:GetOrderedDataStore("TSG_TrainingQueue_v1_" .. ziel)
end

-- ===== Hilfen =====
local function norm(s)
	return string.lower((string.gsub(tostring(s or ""), "[%s%p]", "")))
end
local function textNorm(s)
	s = string.lower(tostring(s or ""))
	for von, nach in pairs({ ["ä"] = "ae", ["ö"] = "oe", ["ü"] = "ue", ["Ä"] = "ae", ["Ö"] = "oe", ["Ü"] = "ue", ["ß"] = "ss" }) do
		s = string.gsub(s, von, nach)
	end
	return (string.gsub(s, "[%s%p]", ""))
end
local function mischen(t)
	for i = #t, 2, -1 do
		local j = math.random(i)
		t[i], t[j] = t[j], t[i]
	end
	return t
end
local function zahl(n)
	if math.abs(n - math.floor(n + 0.5)) < 0.05 then
		return tostring(math.floor(n + 0.5))
	end
	return string.format("%.1f", n)
end

-- Farbe eines Rangs: TeamColor des passenden Teams in Studio, sonst die Ersatzfarbe aus der Konfig
local function rangFarbe(kuerzel)
	local r = K.Raenge[kuerzel]
	if not r then
		return "#878C96"
	end
	local gesucht = { norm(r.Team), norm(r.Name) }
	for _, team in ipairs(Teams:GetTeams()) do
		local n = norm(team.Name)
		if n ~= "" and (n == gesucht[1] or n == gesucht[2]) then
			return "#" .. team.TeamColor.Color:ToHex()
		end
	end
	return r.Farbe or "#878C96"
end

local NAME_ZU_KUERZEL = {}
for k, r in pairs(K.Raenge) do
	NAME_ZU_KUERZEL[norm(r.Name)] = k
end
local function kuerzelAusRolle(rolle)
	if type(rolle) ~= "string" then
		return "G"
	end
	local klein = string.lower(rolle)
	if klein:find("alpha%s*test") or klein:match("^%s*%[%s*at%s*%]") then
		return "G"
	end
	local p = klein:match("^%s*%[%s*([^%]]-)%s*%]")
	if p then
		p = p:gsub("%s+", "")
		for k in pairs(K.Raenge) do
			if string.lower(k) == p then
				return k
			end
		end
	end
	local best, laenge = nil, 0
	for k, r in pairs(K.Raenge) do
		local n = string.lower(r.Name)
		if #n > laenge and klein:find(n, 1, true) then
			best, laenge = k, #n
		end
	end
	return best or "LD"
end

-- Rang eines Spielers (frisch aus der Gruppe, höchstens alle 30 Sekunden)
local rangCache = {}
local function rangVon(userId, frisch)
	local c = rangCache[userId]
	if c and not frisch and os.clock() - c.at < 30 then
		return c
	end
	local ok, gruppen = pcall(GroupService.GetGroupsAsync, GroupService, userId)
	if not ok then
		return c or { at = os.clock(), kuerzel = "G", inGruppe = false, fehler = true }
	end
	local info = { at = os.clock(), kuerzel = "G", inGruppe = false }
	for _, g in ipairs(gruppen) do
		if g.Id == K.GruppenId then
			info.inGruppe = true
			info.rolle = g.Role
			info.kuerzel = kuerzelAusRolle(g.Role)
			break
		end
	end
	rangCache[userId] = info
	return info
end

local nameCache = {}
local function idVonName(name)
	if type(name) ~= "string" or not name:match("^[%w_]+$") then
		return nil
	end
	local key = string.lower(name)
	if nameCache[key] == nil then
		local ok, id = pcall(Players.GetUserIdFromNameAsync, Players, name)
		nameCache[key] = ok and id or false
	end
	return nameCache[key] or nil
end

-- ===== Spielerdaten =====
local profile = {}
local function neueDaten()
	return { Spielzeit = 0, ErsterBesuch = os.time(), Rang = nil, Theorie = {}, Warteschlange = nil }
end
local function laden(player)
	local p = profile[player]
	if p then
		while p.laedt do
			task.wait()
		end
		return p
	end
	p = { d = neueDaten(), laedt = true, seit = os.time(), dirty = false }
	if not ECHT then
		p.sim = { rang = "G", seit = os.time(), gruppe = false } -- Simulation: Start als Gast
	end
	profile[player] = p
	if online then
		local ok, gespeichert
		for versuch = 1, 3 do
			ok, gespeichert = pcall(function()
				return store:GetAsync("Spieler_" .. player.UserId)
			end)
			if ok then
				break
			end
			task.wait(versuch)
		end
		if ok and type(gespeichert) == "table" then
			for k, v in pairs(gespeichert) do
				p.d[k] = v
			end
			p.d.Theorie = type(p.d.Theorie) == "table" and p.d.Theorie or {}
		elseif not ok then
			p.nichtSpeichern = true -- lieber nichts überschreiben
			warn("[TSG] Trainingsdaten von " .. player.Name .. " konnten nicht geladen werden: " .. tostring(gespeichert))
		end
	end
	p.laedt = false
	return p
end
local function spielzeit(p)
	return (tonumber(p.d.Spielzeit) or 0) + math.max(0, os.time() - p.seit)
end
local function speichern(player, p)
	p.d.Spielzeit = spielzeit(p)
	p.seit = os.time()
	if not online or p.nichtSpeichern then
		return
	end
	local daten = table.clone(p.d)
	daten.Version = 1
	local ok, fehler = pcall(function()
		store:SetAsync("Spieler_" .. player.UserId, daten, { player.UserId })
	end)
	if ok then
		p.dirty = false
	else
		warn("[TSG] Trainingsdaten von " .. player.Name .. " nicht gespeichert: " .. tostring(fehler))
	end
end

-- ===== Trainings: aus der App (Echtzeit) oder Beispiele (Simulation) =====
local trainings = { at = -1e9, liste = {} }
local simListe
local function simTrainings()
	if not simListe then
		simListe = {}
		local jetzt = os.time()
		for _, s in ipairs(K.Stufen) do
			local name = K.Raenge[s.Ziel].Name
			table.insert(simListe, { id = "sim-" .. s.Ziel .. "-1", ziel = s.Ziel, titel = name .. " Training", start = jetzt + 600, dauer = 60,
				plaetze = 16, server = "Simulation", hostId = 1, hostName = "Roblox", helfer = { "builderman" } })
			table.insert(simListe, { id = "sim-" .. s.Ziel .. "-2", ziel = s.Ziel, titel = name .. " Training", start = jetzt + 86400 + 3600, dauer = 45,
				plaetze = 12, server = "Simulation", hostId = 156, hostName = "builderman", helfer = {} })
		end
	end
	return simListe
end
local function trainingsHolen()
	if not ECHT then
		return simTrainings()
	end
	if os.clock() - trainings.at < 60 then
		return trainings.liste
	end
	trainings.at = os.clock()
	local ok, body = pcall(HttpService.GetAsync, HttpService, K.Backend .. "/api/content", true)
	local ok2, data = false, nil
	if ok then
		ok2, data = pcall(HttpService.JSONDecode, HttpService, body)
	end
	if ok2 and type(data) == "table" and type(data.trainings) == "table" then
		local liste = {}
		for _, x in ipairs(data.trainings) do
			if type(x) == "table" and type(x.id) == "string" and tonumber(x.start) then
				local helfer = {}
				for _, name in ipairs(type(x.helpers) == "table" and x.helpers or {}) do
					if type(name) == "string" then
						table.insert(helfer, name)
					end
				end
				table.insert(liste, {
					id = x.id,
					ziel = NAME_ZU_KUERZEL[norm(x.type)],
					titel = tostring(x.title or ""),
					start = math.floor(tonumber(x.start) / 1000),
					dauer = math.max(15, math.floor(tonumber(x.dur) or 60)),
					plaetze = math.max(1, math.floor(tonumber(x.slots) or 10)),
					server = tostring(x.server or ""),
					hostId = tonumber(x.hostId),
					hostName = tostring(x.hostName or x.host or ""),
					helfer = helfer,
				})
			end
		end
		table.sort(liste, function(a, b)
			return a.start < b.start
		end)
		trainings.liste = liste
		if trainings.fehler then
			print("[TSG] Trainings: wieder mit der App verbunden")
		end
		trainings.fehler = nil
	else
		local grund = not ok and tostring(body) or "Antwort nicht lesbar"
		if trainings.fehler ~= grund then
			warn("[TSG] Trainings aus der App nicht geladen: " .. grund)
		end
		trainings.fehler = grund
	end
	return trainings.liste
end

local personCache = {}
local function person(userId)
	if not userId then
		return nil
	end
	local c = personCache[userId]
	if not c or os.clock() - c.at > 600 then
		local r = rangVon(userId)
		c = { at = os.clock(), kuerzel = r.kuerzel }
		personCache[userId] = c
	end
	return c
end

-- ===== Warteschlange =====
local warte = {} -- ziel → { at, eintraege = { { id, nr } } } (aufsteigend)
local memQueue, memZaehler = {}, ECHT and 0 or 1900
local function queueLesen(ziel)
	local c = warte[ziel]
	if c and os.clock() - c.at < 60 then
		return c.eintraege
	end
	local liste = {}
	if online then
		local ok, fehler = pcall(function()
			local seiten = ordered(ziel):GetSortedAsync(true, 100)
			for seite = 1, 3 do
				for _, e in ipairs(seiten:GetCurrentPage()) do
					local id = tonumber(e.key)
					if id then
						table.insert(liste, { id = id, nr = e.value })
					end
				end
				if seiten.IsFinished or seite == 3 then
					break
				end
				seiten:AdvanceToNextPageAsync()
			end
		end)
		if not ok then
			warn("[TSG] Warteschlange " .. ziel .. " nicht gelesen: " .. tostring(fehler))
			if c then
				c.at = os.clock()
				return c.eintraege
			end
		end
	else
		for id, nr in pairs(memQueue[ziel] or {}) do
			table.insert(liste, { id = id, nr = nr })
		end
		table.sort(liste, function(a, b)
			return a.nr < b.nr
		end)
	end
	warte[ziel] = { at = os.clock(), eintraege = liste }
	return liste
end
local function queueBetreten(ziel, userId)
	local nr
	if online then
		local ok, res = pcall(function()
			return queueStore:IncrementAsync("Zaehler", 1)
		end)
		if not ok then
			warn("[TSG] Warteschlange: keine Nummer bekommen: " .. tostring(res))
			return nil
		end
		nr = res
		local ok2, fehler = pcall(function()
			ordered(ziel):SetAsync(tostring(userId), nr)
		end)
		if not ok2 then
			warn("[TSG] Warteschlange: nicht eingetragen: " .. tostring(fehler))
			return nil
		end
	else
		memZaehler += 1
		nr = memZaehler
		memQueue[ziel] = memQueue[ziel] or {}
		memQueue[ziel][userId] = nr
	end
	warte[ziel] = nil
	return nr
end
local function queueVerlassen(ziel, userId)
	if online then
		pcall(function()
			ordered(ziel):RemoveAsync(tostring(userId))
		end)
	elseif memQueue[ziel] then
		memQueue[ziel][userId] = nil
	end
	warte[ziel] = nil
end

-- Zuteilung: kleinste Nummer zuerst ins früheste Training mit freiem Platz (jeder genau einmal)
local function zuteilung(ziel, liste, eigene)
	local eintraege = table.clone(queueLesen(ziel))
	if eigene then
		local drin = false
		for i, e in ipairs(eintraege) do
			if e.id == eigene.id then
				eintraege[i] = eigene
				drin = true
			end
		end
		if not drin then
			table.insert(eintraege, eigene)
		end
		table.sort(eintraege, function(a, b)
			return a.nr < b.nr
		end)
	end
	local frei = {}
	for i, t in ipairs(liste) do
		frei[i] = t.plaetze
	end
	local von, anzahl = {}, {}
	local i = 1
	for _, e in ipairs(eintraege) do
		while liste[i] and frei[i] <= 0 do
			i += 1
		end
		if not liste[i] then
			break
		end
		frei[i] -= 1
		von[e.id] = liste[i].id
		anzahl[liste[i].id] = (anzahl[liste[i].id] or 0) + 1
	end
	return von, anzahl
end

-- ===== Anforderungen =====
local function xpVon(player)
	local f = player:FindFirstChild(K.XP.Ordner)
	local v = f and f:FindFirstChild(K.XP.Wert)
	return v and tonumber(v.Value) or 0
end

local function pruefen(player, p, rang, a)
	local typ = a.Typ
	-- Simulation: alles startet bei 0 und springt nach 10 Sekunden auf den nötigen Wert
	local simFertig = p.sim and os.time() - p.sim.seit >= SIM_SEKUNDEN
	if typ == "Gruppe" then
		local drin = rang.inGruppe or simFertig == true
		return drin and 1 or 0, not drin and "click to join" or nil, not drin and "gruppe" or nil
	elseif typ == "XP" then
		local soll = math.max(1, math.floor(tonumber(a.Menge) or 1))
		local xp = p.sim and (simFertig and soll or 0) or math.floor(xpVon(player))
		return math.clamp(xp / soll, 0, 1), string.format("%d / %d XP", math.min(xp, soll), soll)
	elseif typ == "Spielzeit" then
		local soll = math.max(0.01, tonumber(a.Stunden) or 1)
		local h = p.sim and (simFertig and soll or 0) or spielzeit(p) / 3600
		return math.clamp(h / soll, 0, 1), zahl(math.min(h, soll)) .. " / " .. zahl(soll) .. " h"
	elseif typ == "ImRang" then
		local soll = math.max(0.01, tonumber(a.Tage) or 1)
		local tage
		if p.sim then
			tage = simFertig and soll or 0
		else
			local seit = (p.d.Rang and tonumber(p.d.Rang.Seit)) or os.time()
			tage = (os.time() - seit) / 86400
		end
		return math.clamp(tage / soll, 0, 1), zahl(math.min(tage, soll)) .. " / " .. zahl(soll) .. " d"
	elseif p.sim then
		return simFertig and 1 or 0, nil
	elseif typ == "Attribut" then
		local v = player:GetAttribute(a.Name)
		if type(a.Wert) == "number" then
			local n = tonumber(v) or 0
			return math.clamp(n / math.max(1e-6, a.Wert), 0, 1), zahl(n) .. " / " .. zahl(a.Wert)
		end
		local soll = a.Wert
		if soll == nil then
			soll = true
		end
		return v == soll and 1 or 0, nil
	elseif typ == "Funktion" and type(a.Pruefen) == "function" then
		local ok, wert, anzeige = pcall(a.Pruefen, player, { XP = xpVon(player), Spielzeit = spielzeit(p), Rang = rang.kuerzel })
		if not ok then
			warn("[TSG] Anforderung „" .. tostring(a.Text) .. "“: " .. tostring(wert))
			return 0, nil
		end
		if wert == true then
			wert = 1
		elseif not wert then
			wert = 0
		end
		return math.clamp(tonumber(wert) or 0, 0, 1), anzeige ~= nil and tostring(anzeige) or nil
	end
	return 0, nil
end

local function stufeVon(kuerzel)
	for i, s in ipairs(K.Stufen) do
		for _, v in ipairs(s.Von) do
			if v == kuerzel then
				return i, s
			end
		end
	end
	return nil, nil
end

-- ===== Theorie =====
local function theorieStatus(p, ziel)
	local t = p.d.Theorie[ziel]
	if type(t) == "table" and t.Bestanden then
		return "bestanden", t
	end
	if type(t) == "table" and t.GesperrtBis and t.GesperrtBis > os.time() then
		return "sperre", t
	end
	return "offen", t
end

local function fragenAuswahl(p, ziel, stufe)
	local s = p.sitzung
	if s and s.ziel == ziel then
		return s
	end
	local pool = stufe.Fragen or {}
	local idx = {}
	for i = 1, #pool do
		idx[i] = i
	end
	mischen(idx)
	local auswahl = {}
	for i = 1, math.min(K.MaxFragen, #idx) do
		local q = pool[idx[i]]
		local perm = {}
		for k = 1, #(q.Optionen or {}) do
			perm[k] = k
		end
		auswahl[i] = { q = q, perm = mischen(perm) }
	end
	s = { ziel = ziel, id = HttpService:GenerateGUID(false), auswahl = auswahl }
	p.sitzung = s
	return s
end

local function fragenFuerClient(s)
	local out = {}
	for i, e in ipairs(s.auswahl) do
		local q = e.q
		local optionen = {}
		for k, orig in ipairs(e.perm) do
			optionen[k] = tostring(q.Optionen[orig])
		end
		out[i] = { Typ = q.Typ, Text = tostring(q.Text), Punkte = tonumber(q.Punkte) or 1, Optionen = optionen }
	end
	return out
end

local function richtig(e, antwort)
	local q, perm = e.q, e.perm
	if q.Typ == "Auswahl" then
		local k = tonumber(antwort)
		return k ~= nil and perm[k] == q.Richtig
	elseif q.Typ == "Mehrfach" then
		if type(antwort) ~= "table" then
			return false
		end
		local gewaehlt, soll = {}, {}
		for _, k in ipairs(antwort) do
			k = tonumber(k)
			if k and perm[k] then
				gewaehlt[perm[k]] = true
			end
		end
		for _, r in ipairs(q.Richtig or {}) do
			soll[r] = true
		end
		for i = 1, #q.Optionen do
			if (gewaehlt[i] == true) ~= (soll[i] == true) then
				return false
			end
		end
		return true
	elseif q.Typ == "Text" then
		if type(antwort) ~= "string" then
			return false
		end
		local a = textNorm(antwort:sub(1, 200))
		for _, r in ipairs(q.Antworten or {}) do
			if a ~= "" and textNorm(r) == a then
				return true
			end
		end
	end
	return false
end

-- ===== Zustand für das Menü =====
local function zeile(tr, anzahl, meinId)
	local host = ECHT and person(tr.hostId) or { kuerzel = tr.hostId == 1 and "CEN" or "SV" }
	local helfer = {}
	for _, name in ipairs(tr.helfer) do
		local id = idVonName(name)
		if id then
			table.insert(helfer, { Id = id, Name = name })
		end
	end
	local jetzt = os.time()
	return {
		Id = tr.id,
		Ziel = tr.ziel and K.Raenge[tr.ziel] and K.Raenge[tr.ziel].Name or nil,
		ZielFarbe = tr.ziel and rangFarbe(tr.ziel) or nil,
		Titel = tr.titel,
		Start = tr.start,
		Dauer = tr.dauer,
		Plaetze = tr.plaetze,
		Belegt = anzahl[tr.id] or 0,
		Server = tr.server,
		HostId = tr.hostId,
		HostName = tr.hostName,
		HostKuerzel = host and host.kuerzel or nil,
		HostFarbe = host and rangFarbe(host.kuerzel) or nil,
		Helfer = helfer,
		Offen = jetzt >= tr.start - K.JoinVorher and jetzt < tr.start + tr.dauer * 60,
		Meins = tr.id == meinId,
	}
end

local function zustand(player, frisch, aktion)
	local p = laden(player)
	local rang
	if p.sim then
		if aktion == "gruppe" then
			p.sim.gruppe = true
		end
		rang = { kuerzel = p.sim.rang, inGruppe = p.sim.gruppe or p.sim.rang ~= "G" }
	else
		rang = rangVon(player.UserId, frisch)
	end
	if not rang.fehler and (type(p.d.Rang) ~= "table" or p.d.Rang.Kuerzel ~= rang.kuerzel) then
		p.d.Rang = { Kuerzel = rang.kuerzel, Seit = os.time() }
		p.dirty = true
	end
	local aus = {
		Jetzt = os.time(),
		JoinVorher = K.JoinVorher,
		GruppenId = K.GruppenId,
		Grenze = K.Bestehensgrenze,
		Simulation = not ECHT,
		Rang = { Kuerzel = rang.kuerzel, Name = (K.Raenge[rang.kuerzel] or {}).Name or rang.kuerzel, Farbe = rangFarbe(rang.kuerzel) },
	}
	if p.sim and os.time() < p.sim.seit + SIM_SEKUNDEN then
		aus.Aktualisieren = p.sim.seit + SIM_SEKUNDEN -- dann springen die Werte: Menü lädt neu
	end
	local nr, stufe = stufeVon(rang.kuerzel)
	if not stufe then
		aus.KeinTraining = true
		if type(p.d.Warteschlange) == "table" then
			queueVerlassen(p.d.Warteschlange.Ziel, player.UserId)
			p.d.Warteschlange = nil
			p.dirty = true
		end
		-- Leitung und Supervisors: ihre eigenen Trainings (damit sie in den Trainingsserver kommen)
		local jetzt = os.time()
		local eigene = {}
		for _, tr in ipairs(trainingsHolen()) do
			if tr.start + tr.dauer * 60 > jetzt then
				local mein = tr.hostId == player.UserId
				for _, name in ipairs(tr.helfer) do
					mein = mein or idVonName(name) == player.UserId
				end
				if mein then
					table.insert(eigene, tr)
				end
			end
		end
		if #eigene > 0 then
			local zeilen = {}
			for _, tr in ipairs(eigene) do
				local gleiche = {}
				for _, x in ipairs(trainingsHolen()) do
					if tr.ziel and x.ziel == tr.ziel and x.start + x.dauer * 60 > jetzt then
						table.insert(gleiche, x)
					end
				end
				local anzahl = {}
				if tr.ziel then
					anzahl = select(2, zuteilung(tr.ziel, gleiche, nil))
				end
				table.insert(zeilen, zeile(tr, anzahl, eigene[1].id))
			end
			aus.Praktisch = { Leitung = true, Zugewiesen = eigene[1].id, Trainings = zeilen }
		end
		return aus
	end
	local ziel = stufe.Ziel
	aus.Stufe = nr
	aus.Ziel = { Kuerzel = ziel, Name = K.Raenge[ziel].Name, Farbe = rangFarbe(ziel) }

	-- 1. Anforderungen
	local liste, alle = {}, true
	for i, a in ipairs(stufe.Anforderungen or {}) do
		local wert, anzeige, aktion2 = pruefen(player, p, rang, a)
		local fertig = wert >= 0.9999
		alle = alle and fertig
		liste[i] = { Text = tostring(a.Text or ""), Wert = wert, Anzeige = anzeige, Fertig = fertig, Aktion = aktion2 }
	end
	aus.Anforderungen = liste
	aus.AnforderungenFertig = alle

	-- 2. Theorie
	local status, t = theorieStatus(p, ziel)
	if status ~= "bestanden" and not alle then
		status = "gesperrt"
	end
	aus.Theorie = { Status = status, Bis = t and t.GesperrtBis or nil, Prozent = t and t.Prozent or nil }
	if status == "sperre" and t and t.GesperrtBis then
		aus.Aktualisieren = math.min(aus.Aktualisieren or math.huge, t.GesperrtBis)
	end
	if status == "offen" then
		local s = fragenAuswahl(p, ziel, stufe)
		aus.Theorie.Id = s.id
		aus.Theorie.Fragen = fragenFuerClient(s)
	end

	-- 3. Praktisch: Warteschlange und Zuteilung
	local w = p.d.Warteschlange
	if type(w) == "table" and w.Ziel ~= ziel then
		queueVerlassen(w.Ziel, player.UserId)
		p.d.Warteschlange = nil
		p.dirty = true
	end
	if status == "bestanden" and type(p.d.Warteschlange) ~= "table" then
		local n = queueBetreten(ziel, player.UserId)
		if n then
			p.d.Warteschlange = { Ziel = ziel, Nummer = n, Seit = os.time() }
			p.dirty = true
		end
	end
	w = p.d.Warteschlange
	local jetzt = os.time()
	local meine = {}
	for _, tr in ipairs(trainingsHolen()) do
		if tr.ziel == ziel and tr.start + tr.dauer * 60 > jetzt then
			table.insert(meine, tr)
		end
	end
	local von, anzahl = zuteilung(ziel, meine, type(w) == "table" and { id = player.UserId, nr = w.Nummer } or nil)
	local meinId = von[player.UserId]
	local zeilen = {}
	for _, tr in ipairs(meine) do
		table.insert(zeilen, zeile(tr, anzahl, meinId))
	end
	table.sort(zeilen, function(a, b)
		if a.Meins ~= b.Meins then
			return a.Meins
		end
		return a.Start < b.Start
	end)
	aus.Praktisch = {
		Nummer = type(w) == "table" and w.Nummer or nil,
		Zugewiesen = meinId,
		Trainings = zeilen,
		AppFehler = ECHT and trainings.fehler ~= nil,
	}
	if p.sim and p.sim.befoerdertAm then
		aus.Aktualisieren = math.min(aus.Aktualisieren or math.huge, p.sim.befoerdertAm)
	end
	return aus
end

rZustand.OnServerInvoke = function(player, frisch, aktion)
	local ok, res = pcall(zustand, player, frisch == true, aktion)
	if not ok then
		warn("[TSG] Trainings-Zustand für " .. player.Name .. ": " .. tostring(res))
		return { Fehler = true }
	end
	return res
end

rAbsenden.OnServerInvoke = function(player, sitzungId, antworten)
	local p = laden(player)
	if p.sendet then
		return { Ok = false, Text = "Please wait a moment …" }
	end
	p.sendet = true
	local ok, res = pcall(function()
		local z = zustand(player)
		if not z.Theorie or z.Theorie.Status ~= "offen" then
			return { Ok = false, Text = "The theory is not open right now." }
		end
		local s = p.sitzung
		if not s or s.id ~= sitzungId then
			return { Ok = false, Text = "The quiz has changed – please try again." }
		end
		if type(antworten) ~= "table" then
			antworten = {}
		end
		local punkte, max = 0, 0
		for i, e in ipairs(s.auswahl) do
			local gewicht = tonumber(e.q.Punkte) or 1
			max += gewicht
			if richtig(e, antworten[tostring(i)]) then
				punkte += gewicht
			end
		end
		local anteil = max > 0 and punkte / max or 0
		local prozent = math.floor(anteil * 100 + 0.5)
		local ziel = s.ziel
		p.sitzung = nil
		local alt = p.d.Theorie[ziel]
		local versuche = ((type(alt) == "table" and tonumber(alt.Versuche)) or 0) + 1
		if anteil + 1e-9 >= K.Bestehensgrenze then
			p.d.Theorie[ziel] = { Bestanden = os.time(), Prozent = prozent, Versuche = versuche }
			p.dirty = true
			local n = queueBetreten(ziel, player.UserId)
			if n then
				p.d.Warteschlange = { Ziel = ziel, Nummer = n, Seit = os.time() }
			end
			task.spawn(speichern, player, p)
			return { Ok = true, Bestanden = true, Prozent = prozent, Nummer = n }
		end
		-- Echtzeit: exakt 4 Tage ab jetzt, Simulation: 10 Sekunden
		local bis = os.time() + (ECHT and K.Sperre or SIM_SEKUNDEN)
		p.d.Theorie[ziel] = { GesperrtBis = bis, Prozent = prozent, Versuche = versuche }
		p.dirty = true
		task.spawn(speichern, player, p)
		return { Ok = true, Bestanden = false, Prozent = prozent, Bis = bis }
	end)
	task.delay(2, function()
		p.sendet = false
	end)
	if not ok then
		warn("[TSG] Theorie von " .. player.Name .. ": " .. tostring(res))
		return { Ok = false, Text = "Something went wrong – please try again." }
	end
	return res
end

-- ===== Join: reservierter Server je Training =====
local reserviert = {}
local function serverCode(trainingId)
	if reserviert[trainingId] then
		return reserviert[trainingId]
	end
	if online then
		local ok, alt = pcall(function()
			return serverStore:GetAsync(trainingId)
		end)
		if ok and type(alt) == "table" and type(alt.Code) == "string" then
			reserviert[trainingId] = alt.Code
			return alt.Code
		end
	end
	local ok, code = pcall(TeleportService.ReserveServer, TeleportService, game.PlaceId)
	if not ok then
		return nil, code
	end
	if online then
		local endgueltig = code
		pcall(function()
			serverStore:UpdateAsync(trainingId, function(alt)
				if type(alt) == "table" and type(alt.Code) == "string" then
					endgueltig = alt.Code -- ein anderer Server war schneller: denselben Server nehmen
					return nil
				end
				endgueltig = code
				return { Code = code, At = os.time() }
			end)
		end)
		code = endgueltig
	end
	reserviert[trainingId] = code
	return code
end

rBeitreten.OnServerInvoke = function(player, trainingId)
	if type(trainingId) ~= "string" then
		return { Ok = false, Text = "Unknown training." }
	end
	local tr
	for _, x in ipairs(trainingsHolen()) do
		if x.id == trainingId then
			tr = x
		end
	end
	if not tr then
		return { Ok = false, Text = "This training no longer exists." }
	end
	local jetzt = os.time()
	if jetzt < tr.start - K.JoinVorher then
		return { Ok = false, Text = string.format("The server opens %d minutes before the start.", math.floor(K.JoinVorher / 60)) }
	end
	if jetzt >= tr.start + tr.dauer * 60 then
		return { Ok = false, Text = "This training is already over." }
	end
	local darf = tr.hostId == player.UserId
	for _, name in ipairs(tr.helfer) do
		if idVonName(name) == player.UserId then
			darf = true
		end
	end
	if not darf then
		local ok, z = pcall(zustand, player)
		darf = ok and z.Praktisch ~= nil and z.Praktisch.Zugewiesen == trainingId
	end
	if not darf then
		return { Ok = false, Text = "You are not assigned to this training." }
	end
	local p = laden(player)
	if p.sim then
		-- Simulation: Training „besucht“, nach 10 Sekunden in den nächsten Rang
		if not p.sim.befoerdertAm then
			local ziel = tr.ziel
			p.sim.befoerdertAm = os.time() + SIM_SEKUNDEN
			task.delay(SIM_SEKUNDEN, function()
				if profile[player] == p and ziel then
					if p.d.Warteschlange then
						queueVerlassen(p.d.Warteschlange.Ziel, player.UserId)
						p.d.Warteschlange = nil
					end
					p.sim.rang = ziel
					p.sim.seit = os.time()
					p.sim.befoerdertAm = nil
					p.sitzung = nil
				end
			end)
		end
		return { Ok = true, Text = string.format("Simulation: training joined – you will be promoted to %s in %d seconds.", K.Raenge[tr.ziel] and K.Raenge[tr.ziel].Name or "the next rank", SIM_SEKUNDEN), Aktualisieren = p.sim.befoerdertAm }
	end
	if RunService:IsStudio() then
		return { Ok = false, Text = "Teleporting only works in the live game, not in Studio." }
	end
	local code, fehler = serverCode(trainingId)
	if not code then
		warn("[TSG] Trainingsserver nicht reserviert: " .. tostring(fehler))
		return { Ok = false, Text = "The training server could not be reserved – please try again." }
	end
	local opts = Instance.new("TeleportOptions")
	opts.ReservedServerAccessCode = code
	opts:SetTeleportData({ TSGTraining = trainingId })
	local ok, e = pcall(TeleportService.TeleportAsync, TeleportService, game.PlaceId, { player }, opts)
	if not ok then
		return { Ok = false, Text = "Teleport failed: " .. tostring(e) }
	end
	return { Ok = true, Text = "Teleporting to the training server …" }
end

-- ===== Laden und Speichern =====
Players.PlayerAdded:Connect(function(player)
	laden(player)
end)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(laden, player)
end
Players.PlayerRemoving:Connect(function(player)
	local p = profile[player]
	if p then
		speichern(player, p)
		profile[player] = nil
	end
	rangCache[player.UserId] = nil
end)
task.spawn(function()
	while true do
		task.wait(120)
		for player, p in pairs(profile) do
			if not p.laedt then
				task.spawn(speichern, player, p) -- auch die Spielzeit
			end
		end
	end
end)
game:BindToClose(function()
	local offen = 0
	for player, p in pairs(profile) do
		offen += 1
		task.spawn(function()
			speichern(player, p)
			offen -= 1
		end)
	end
	local start = os.clock()
	while offen > 0 and os.clock() - start < 25 do
		task.wait(0.1)
	end
end)
