--[[
  Train Sim Germany – Züge fahren (Server)

  Einrichten: als Script nach ServerScriptService legen. Es steuert jeden Zug mit dem Tag „TSGTrain“
  (den setzt game/train/TSGTrainSetup.lua beim Einrichten). Dazu gehört game/train/TSGTrainDriver.client.lua.

  Bedienung im Führerstand (Sitz „DriverSeat“):
    W / S   Fahrschalter: W schiebt Richtung Fahrt (bis 100 %), S zurück bis in die Bremse (bis 100 %).
            Der Hebel bleibt stehen, wenn man loslässt – wie im echten Zug.
    D / A   Richtung: D = vorwärts, A = rückwärts, dazwischen Neutral (R ← N → V).
            Gewechselt wird nur im Stand; auf Neutral geht immer (dann rollt der Zug).
    P       Stromabnehmer heben bzw. senken. Ohne gehobenen Stromabnehmer gibt es keine Zugkraft.
  Steigt der Fahrer aus, bremst der Zug von selbst bis zum Stillstand.

  Strecke: Liegt im Workspace ein Ordner „TSGTrack“ (oder der Name aus dem Attribut „Track“ am Zug) mit Punkten
  (Parts oder Attachments) namens 1, 2, 3 … in Gleismitte auf Schienenhöhe, folgt der Zug dieser Linie – auch in
  Kurven und Steigungen. Ohne Ordner fährt er geradeaus in Blickrichtung.

  Technik: Der Zug ist ein einziges, verschweißtes Bauteil mit dem unsichtbaren „Root“ in der Mitte. Zwei starre
  Constraints (AlignPosition, AlignOrientation) führen den Root auf die berechnete Position. Weil der Zug dabei
  wirklich fährt (nicht nur versetzt wird), nimmt er Spieler im Fahrgastraum mit. Der Zug kollidiert nur mit
  Spielern (Kollisionsgruppen „TSGTrain“ und „TSGPlayers“), nicht mit Bahnsteigen, Gleisen oder Gelände.
]]

local CollectionService = game:GetService("CollectionService")
local PhysicsService = game:GetService("PhysicsService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local TAG = "TSGTrain"
local LEVER_UP = 0.6 -- Fahrschalter: Anteil pro Sekunde bei gehaltenem W
local LEVER_DOWN = 0.9 -- bei gehaltenem S
local AUTO_BRAKE = 0.8 -- ohne Fahrer
local PANTO_TIME = 3 -- Sekunden zum Heben bzw. Senken
local STANDSTILL = 0.3 -- m/s: darunter gilt der Zug als stehend (Richtungswechsel erlaubt)

-- Verbindung zu den Spielern (TSGTrainDriver.client.lua)
local remote = ReplicatedStorage:FindFirstChild("TSGTrainControl")
if not remote then
	remote = Instance.new("RemoteEvent")
	remote.Name = "TSGTrainControl"
	remote.Parent = ReplicatedStorage
end

-- ===== Kollision: Zug ↔ Spieler ja, Zug ↔ Welt nein =====
for _, name in ipairs({ "TSGTrain", "TSGPlayers" }) do
	pcall(function()
		PhysicsService:RegisterCollisionGroup(name)
	end)
end
PhysicsService:CollisionGroupSetCollidable("TSGTrain", "Default", false)
PhysicsService:CollisionGroupSetCollidable("TSGTrain", "TSGTrain", false)
PhysicsService:CollisionGroupSetCollidable("TSGTrain", "TSGPlayers", true)
PhysicsService:CollisionGroupSetCollidable("TSGPlayers", "Default", true)

local function playerPart(obj)
	if obj:IsA("BasePart") then
		obj.CollisionGroup = "TSGPlayers"
	end
end
local function watchCharacter(character)
	for _, d in ipairs(character:GetDescendants()) do
		playerPart(d)
	end
	character.DescendantAdded:Connect(playerPart)
end
local function watchPlayer(player)
	if player.Character then
		watchCharacter(player.Character)
	end
	player.CharacterAdded:Connect(watchCharacter)
end
Players.PlayerAdded:Connect(watchPlayer)
for _, player in ipairs(Players:GetPlayers()) do
	watchPlayer(player)
end

-- ===== MATH BEGIN (Strecke und Stromabnehmer, ohne Roblox-Objekte – wird auch außerhalb von Roblox getestet) =====

-- Strecke aus Punkten: Catmull-Rom-Kurve, alle ~2 Studs ein Stützpunkt mit zurückgelegter Länge
local function buildPath(nodes)
	if #nodes < 2 then
		return nil
	end
	local function node(i)
		return nodes[math.clamp(i, 1, #nodes)]
	end
	local points = {}
	for i = 1, #nodes - 1 do
		local p0, p1, p2, p3 = node(i - 1), node(i), node(i + 1), node(i + 2)
		local steps = math.max(2, math.ceil((p2 - p1).Magnitude / 2))
		for k = 0, steps - 1 do
			local t = k / steps
			local t2, t3 = t * t, t * t * t
			table.insert(points, ((p1 * 2) + (p2 - p0) * t + (p0 * 2 - p1 * 5 + p2 * 4 - p3) * t2 + (p1 * 3 - p0 - p2 * 3 + p3) * t3) * 0.5)
		end
	end
	table.insert(points, nodes[#nodes])
	local dist = { 0 }
	for i = 2, #points do
		dist[i] = dist[i - 1] + (points[i] - points[i - 1]).Magnitude
	end
	return { points = points, dist = dist, length = dist[#dist] }
end

-- Punkt bei Länge s (binäre Suche)
local function pathPoint(path, s)
	local d, p = path.dist, path.points
	if s <= 0 then
		return p[1]
	end
	if s >= path.length then
		return p[#p]
	end
	local lo, hi = 1, #d
	while hi - lo > 1 do
		local mid = (lo + hi) // 2
		if d[mid] <= s then
			lo = mid
		else
			hi = mid
		end
	end
	local span = d[hi] - d[lo]
	local f = span > 0 and (s - d[lo]) / span or 0
	return p[lo] + (p[hi] - p[lo]) * f
end

-- Länge des Stützpunkts, der pos am nächsten liegt
local function nearestS(path, pos)
	local best, bestS = math.huge, 0
	for i, p in ipairs(path.points) do
		local m = (p - pos).Magnitude
		if m < best then
			best, bestS = m, path.dist[i]
		end
	end
	return bestS
end

-- Winkel eines Vektors in der Ebene längs zum Zug (Root-Raum: Y oben, Z längs). Drehung um X um θ erhöht ihn um θ.
local function psi(v)
	return math.atan2(v.Z, v.Y)
end

-- Einholm-Stromabnehmer: Knie für die Spitze tip (Gelenk hinge, Unterarm a, Oberarm b).
-- Das Knie bleibt auf derselben Seite des Gelenks wie im eingeklappten Zustand (knee0).
local function solveKnee(hinge, tip, a, b, knee0)
	local dz, dy = tip.Z - hinge.Z, tip.Y - hinge.Y
	local len = math.sqrt(dz * dz + dy * dy)
	if len < 1e-6 then
		return knee0
	end
	local uz, uy = dz / len, dy / len
	local d = math.clamp(len, math.abs(a - b) + 1e-4, a + b - 1e-4)
	local x = (a * a - b * b + d * d) / (2 * d)
	local h = math.sqrt(math.max(0, a * a - x * x))
	local pz, py = hinge.Z + uz * x, hinge.Y + uy * x
	local nz, ny = -uy, uz
	local side = (knee0.Z - hinge.Z) >= 0 and 1 or -1
	local z1, y1 = pz + nz * h, py + ny * h
	local z2, y2 = pz - nz * h, py - ny * h
	if (z2 - hinge.Z) * side > (z1 - hinge.Z) * side then
		z1, y1 = z2, y2
	end
	return Vector3.new(knee0.X, y1, z1)
end

-- Stellung des Stromabnehmers bei t (0 = gesenkt, 1 = gehoben): Drehwinkel von Unter- und Oberarm, neues Knie, neue Spitze
local function pantographPose(hinge, knee, tip, a, b, raise, t)
	local tip2 = tip + Vector3.new(0, raise * t, 0)
	local knee2 = solveKnee(hinge, tip2, a, b, knee)
	return psi(knee2 - hinge) - psi(knee - hinge), psi(tip2 - knee2) - psi(tip - knee), knee2, tip2
end

-- Fahrphysik: neue Geschwindigkeit (m/s) aus Hebel (-1 … 1), Richtung, Strom
local function physicsStep(v, lever, traction, acc, brake, vmax, dt)
	local a = 0
	if lever > 0 and traction then
		a = acc * lever * math.max(0, 1 - (v / vmax) ^ 2)
	elseif lever < 0 then
		a = brake * lever
	end
	if v > 0 then
		a = a - (0.015 + 0.00004 * v * v) -- Roll- und Luftwiderstand
	end
	return math.clamp(v + a * dt, 0, vmax)
end

-- ===== MATH END =====

local function rotX(p, angle)
	return CFrame.new(p) * CFrame.Angles(angle, 0, 0) * CFrame.new(-p)
end

local trains = {}

local function notify(player, text)
	if player then
		remote:FireClient(player, "message", text)
	end
end

-- Stromabnehmer: Gelenke (Motor6D „TSGPantoJoint“) nach der Stellung t setzen
local function applyPantographs(st, t)
	for _, rig in ipairs(st.rigs) do
		local mode = rig:GetAttribute("Mode")
		local hinge = rig:GetAttribute("Hinge")
		local lowerC, upperC, headC
		if mode == "ik" then
			local knee, tip = rig:GetAttribute("Knee"), rig:GetAttribute("Tip")
			local th1, th2, knee2, tip2 = pantographPose(hinge, knee, tip, rig:GetAttribute("ArmA"), rig:GetAttribute("ArmB"), rig:GetAttribute("Raise"), t)
			lowerC = rotX(hinge, th1)
			upperC = CFrame.new(knee2 - knee) * rotX(knee, th2)
			headC = CFrame.new(tip2 - tip)
		elseif mode == "rigid" then
			lowerC = rotX(hinge, rig:GetAttribute("Angle") * t)
		end
		if lowerC then
			for _, joint in ipairs(rig:GetDescendants()) do
				if joint:IsA("Motor6D") and joint.Name == "TSGPantoJoint" then
					local role = joint:GetAttribute("Role")
					local move = (role == "upper" and upperC) or (role == "head" and headC) or lowerC
					joint.C0 = move * joint:GetAttribute("C0Base")
				end
			end
		end
	end
end

local function setPantograph(st, up)
	st.panto = up
	st.model:SetAttribute("Pantograph", up and "rising" or "lowering")
	if st.pantoTween then
		st.pantoTween:Cancel()
	end
	local goal = up and 1 or 0
	local time = math.max(0.3, PANTO_TIME * math.abs(goal - st.pantoValue.Value))
	st.pantoTween = TweenService:Create(st.pantoValue, TweenInfo.new(time, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { Value = goal })
	st.pantoTween.Completed:Connect(function(state)
		if state == Enum.PlaybackState.Completed then
			st.model:SetAttribute("Pantograph", st.panto and "up" or "down")
		end
	end)
	st.pantoTween:Play()
end

local function trackNodes(folder)
	local list = {}
	for _, n in ipairs(folder:GetChildren()) do
		local order = n:GetAttribute("Order") or tonumber(n.Name)
		local pos = (n:IsA("BasePart") and n.Position) or (n:IsA("Attachment") and n.WorldPosition) or nil
		if order and pos then
			table.insert(list, { order = order, pos = pos })
		end
	end
	table.sort(list, function(a, b)
		return a.order < b.order
	end)
	local out = {}
	for i, n in ipairs(list) do
		out[i] = n.pos
	end
	return out
end

local function setupTrain(model)
	if trains[model] or not model:IsDescendantOf(Workspace) then
		return
	end
	local root = model.PrimaryPart or model:FindFirstChild("Root")
	local seat = model:FindFirstChild("DriverSeat", true)
	if not root then
		warn("[TSG] " .. model:GetFullName() .. ": kein Root – bitte zuerst TSGTrainSetup ausführen")
		return
	end
	-- Hilfsteile (Führersitz, unsichtbare Wände) sind nur in Studio sichtbar
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") and d:GetAttribute("TSGHelper") then
			d.Transparency = 1
		end
	end

	local length = model:GetAttribute("Length") or 60
	local st = {
		model = model, root = root, seat = seat, v = 0, md = 1, dir = 0, lever = 0, input = 0,
		panto = false, pantoPos = 0, driver = nil, s = 0, startCF = root.CFrame, attrT = 0,
		mps = model:GetAttribute("MetersPerStud") or 0.28, rigs = {},
	}
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("Model") and d:GetAttribute("Mode") and d:GetAttribute("Hinge") then
			table.insert(st.rigs, d)
		end
	end

	-- Strecke
	local folder = Workspace:FindFirstChild(model:GetAttribute("Track") or "TSGTrack")
	st.path = folder and buildPath(trackNodes(folder)) or nil
	if st.path then
		st.half = math.min(length * 0.4, st.path.length * 0.45)
		st.s = math.clamp(nearestS(st.path, root.Position), st.half, st.path.length - st.half)
		local tangent = pathPoint(st.path, st.s + 1) - pathPoint(st.path, st.s - 1)
		st.sign = tangent:Dot(root.CFrame.LookVector) >= 0 and 1 or -1
	end

	-- Führung: starr auf die berechnete Position
	local att = Instance.new("Attachment")
	att.Name = "TSGAlign"
	att.Parent = root
	local ap = Instance.new("AlignPosition")
	ap.Mode = Enum.PositionAlignmentMode.OneAttachment
	ap.Attachment0 = att
	ap.RigidityEnabled = true
	ap.Position = root.Position
	ap.Parent = root
	local ao = Instance.new("AlignOrientation")
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.RigidityEnabled = true
	ao.CFrame = root.CFrame
	ao.Parent = root
	st.ap, st.ao = ap, ao
	root.Anchored = false
	pcall(function()
		root:SetNetworkOwner(nil)
	end)

	-- Stromabnehmer
	st.pantoValue = Instance.new("NumberValue")
	st.pantoValue.Name = "TSGPantoPosition"
	st.pantoValue.Parent = model
	st.pantoValue.Changed:Connect(function(value)
		st.pantoPos = value
		applyPantographs(st, value)
	end)

	model:SetAttribute("Speed", 0)
	model:SetAttribute("Lever", 0)
	model:SetAttribute("Direction", 0)
	model:SetAttribute("Pantograph", "down")
	model:SetAttribute("Driver", nil)

	-- Führersitz: hinsetzen per Taste E (oder einfach draufsetzen)
	if seat then
		local prompt = Instance.new("ProximityPrompt")
		prompt.ActionText = "Führerstand"
		prompt.ObjectText = model.Name
		prompt.HoldDuration = 0.2
		prompt.MaxActivationDistance = 8
		prompt.RequiresLineOfSight = false
		prompt.Parent = seat
		prompt.Triggered:Connect(function(player)
			local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
			if humanoid and not seat.Occupant then
				seat:Sit(humanoid)
			end
		end)
		seat:GetPropertyChangedSignal("Occupant"):Connect(function()
			local humanoid = seat.Occupant
			local player = humanoid and Players:GetPlayerFromCharacter(humanoid.Parent)
			if st.driver and st.driver ~= player then
				st.driver:SetAttribute("TSG_Vehicle", nil)
			end
			st.driver = player
			st.input = 0
			prompt.Enabled = player == nil
			model:SetAttribute("Driver", player and player.UserId or nil)
			-- Für die App (TSGAppSync): welcher Zug gerade gefahren wird
			if player then
				player:SetAttribute("TSG_Vehicle", model:GetAttribute("VehicleId"))
			end
		end)
	else
		warn("[TSG] " .. model.Name .. ": kein DriverSeat – der Zug lässt sich nicht fahren")
	end

	trains[model] = st
end

local function step(st, dt)
	local model = st.model
	-- Fahrschalter
	if not st.driver then
		st.lever = math.max(-1, st.lever - AUTO_BRAKE * dt)
	elseif st.input > 0 then
		st.lever = math.min(1, st.lever + LEVER_UP * dt)
	elseif st.input < 0 then
		st.lever = math.max(-1, st.lever - LEVER_DOWN * dt)
	end
	-- Geschwindigkeit
	if st.v < 0.05 and st.dir ~= 0 then
		st.md = st.dir
	end
	local vmax = (model:GetAttribute("MaxSpeedKmh") or 160) / 3.6
	local traction = st.dir ~= 0 and st.dir == st.md and st.panto and st.pantoPos >= 0.999
	st.v = physicsStep(st.v, st.lever, traction, model:GetAttribute("Acceleration") or 1.1, model:GetAttribute("Braking") or 1.2, vmax, dt)
	local ds = st.md * st.v * dt / st.mps

	-- Neue Lage
	local target
	if st.path then
		local lo, hi = st.half, st.path.length - st.half
		local s = st.s + ds * st.sign
		if s <= lo or s >= hi then
			s = math.clamp(s, lo, hi)
			if st.v > 0 then
				st.v = 0
				notify(st.driver, "Ende der Strecke")
			end
		end
		st.s = s
		local front = pathPoint(st.path, s + st.sign * st.half)
		local rear = pathPoint(st.path, s - st.sign * st.half)
		target = CFrame.lookAt((front + rear) / 2, front)
	else
		st.s += ds
		target = st.startCF * CFrame.new(0, 0, -st.s)
	end
	st.ap.Position = target.Position
	st.ao.CFrame = target

	-- Für die Anzeige im Führerstand (10-mal pro Sekunde)
	st.attrT += dt
	if st.attrT >= 0.1 then
		st.attrT = 0
		model:SetAttribute("Speed", math.floor(st.v * 3.6 + 0.5))
		model:SetAttribute("Lever", math.floor(st.lever * 100 + 0.5) / 100)
	end
end

RunService.PreSimulation:Connect(function(dt)
	for model, st in pairs(trains) do
		if model.Parent and st.root.Parent then
			step(st, dt)
		else
			trains[model] = nil
		end
	end
end)

-- Eingaben aus dem Führerstand (nur vom Fahrer des Zuges)
remote.OnServerEvent:Connect(function(player, model, action, value)
	local st = typeof(model) == "Instance" and trains[model]
	if not st or st.driver ~= player then
		return
	end
	if action == "throttle" then
		st.input = (value == 1 and 1) or (value == -1 and -1) or 0
	elseif action == "direction" then
		local stepDir = (value == 1 and 1) or (value == -1 and -1) or 0
		local new = math.clamp(st.dir + stepDir, -1, 1)
		if new == st.dir then
			return
		end
		if new ~= 0 and st.v > STANDSTILL and new ~= st.md then
			notify(player, "Erst anhalten, dann die Richtung wechseln.")
			return
		end
		st.dir = new
		model:SetAttribute("Direction", new)
	elseif action == "pantograph" then
		setPantograph(st, not st.panto)
	end
end)

CollectionService:GetInstanceAddedSignal(TAG):Connect(setupTrain)
for _, model in ipairs(CollectionService:GetTagged(TAG)) do
	setupTrain(model)
end
