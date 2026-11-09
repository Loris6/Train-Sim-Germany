--[[
  Train Sim Germany – Trainings im Menü (Client)
  Liegt als LocalScript in StarterGui.Menu.container.Training. Füllt das vorhandene Layout mit Leben:
    Top:      3 Abschnitte (Anforderungen, Theorie, Praktisch) – fertige grün mit Haken
    Frames:   Anforderungen, Theory, Assessment, calender (unter canvas.items)
    bottom:   ← Return (Kalender → zurück zum Assessment, sonst Training schließen und die Buttons zeigen),
              Guides (noch ohne Funktion), Kalender, „Join Assessment →“ (nur grün und klickbar, wenn der Server offen ist)
    notify:   Meldungen (im selben Parent wie das Training)
  Die Vorlagen im Layout (Zeilen, Fragen Q1 … Q10, Kalenderzeile, Tags, Profile) werden geklont und dynamisch befüllt.
  Daten kommen vom Server (ServerScriptService.TSGTraining), Einstellungen in ServerStorage.TSGTrainingKonfig.
]]

local GroupService = game:GetService("GroupService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local Training = script.Parent
local container = Training.Parent
local menu = Training:FindFirstAncestorWhichIsA("ScreenGui")
local Buttons = container:FindFirstChild("Buttons")
local notify = container:FindFirstChild("notify")
local Top = Training:WaitForChild("Top")
local bottom = Training:WaitForChild("bottom")
local items = Training:WaitForChild("canvas"):WaitForChild("items")

local function kind(parent, ...)
	if not parent then
		return nil
	end
	for _, n in ipairs({ ... }) do
		local c = parent:FindFirstChild(n)
		if c then
			return c
		end
	end
	return nil
end

local F = {
	Anforderungen = kind(items, "Anforderungen", "Requirements"),
	Theorie = kind(items, "Theorie", "Theory"),
	Assessment = kind(items, "Assessment", "Praktisch"),
	Calender = kind(items, "Calender", "calender", "Kalender"),
}
local ORDNUNG = { Anforderungen = 1, Theorie = 2, Assessment = 3, Calender = 4 }

local remotes = ReplicatedStorage:WaitForChild("TSGTraining")
local rZustand = remotes:WaitForChild("Zustand")
local rAbsenden = remotes:WaitForChild("Absenden")
local rBeitreten = remotes:WaitForChild("Beitreten")

-- Farben und Bilder wie im Layout
local GRUEN = Color3.fromHex("00ff5e")
local GRUEN_BALKEN = Color3.fromHex("1fa34a")
local ROT = Color3.fromHex("ff2929")
local DUNKEL = Color3.fromHex("000014")
local GRAU = Color3.fromHex("585b67")
local SCHWARZ = Color3.new(0, 0, 0)
local TEXT_DUNKEL = Color3.fromHex("131821")
local WEISS = Color3.new(1, 1, 1)
local HAKEN = "rbxassetid://104065181064771"
local OFFEN_BILD = "rbxassetid://83732171172408"

local function tween(inst, zeit, ziel, stil, richtung, verzoegerung)
	local tw = TweenService:Create(inst, TweenInfo.new(zeit, stil or Enum.EasingStyle.Quint, richtung or Enum.EasingDirection.Out, 0, false, verzoegerung or 0), ziel)
	tw:Play()
	return tw
end
local function esc(s)
	return (tostring(s or ""):gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub("\"", "&quot;"))
end
local function thumb(userId)
	return userId and string.format("rbxthumb://type=AvatarHeadShot&id=%d&w=150&h=150", userId) or ""
end

-- ===== Sounds (aus StarterGui.Menu: „ui-bubble-click“ und „Sound“) =====
local function ton(vorlage, tempo, laut)
	if not vorlage or not vorlage:IsA("Sound") then
		return nil
	end
	local s = vorlage:Clone()
	for _, c in ipairs(s:GetChildren()) do
		c:Destroy()
	end
	s.Name = "TSG_" .. vorlage.Name
	s.Looped = false
	s.PlaybackSpeed = tempo or vorlage.PlaybackSpeed
	s.Volume = vorlage.Volume * (laut or 1)
	s.Parent = script
	return s
end
local klickVorlage = menu and menu:FindFirstChild("ui-bubble-click", true)
local KLICK = ton(klickVorlage, 1, 0.6)
local HOVER = ton(klickVorlage, 1.5, 0.25)
local WECHSEL = ton(menu and menu:FindFirstChild("Sound"), 1, 0.35) or KLICK
local function spiele(s)
	if s then
		s.TimePosition = 0
		s:Play()
	end
end

-- Knöpfe: Hover-Ton, leichtes Vergrößern, Klick-Ton und kurzes Eindrücken
local function istAus(btn)
	return btn:GetAttribute("TSGAus") == true
end
local function knopf(btn, beiKlick, ohneSkala)
	if not btn or not btn:IsA("GuiButton") then
		return
	end
	local skala
	if not ohneSkala then
		skala = btn:FindFirstChild("TSGSkala") or Instance.new("UIScale")
		skala.Name = "TSGSkala"
		skala.Parent = btn
	end
	btn.MouseEnter:Connect(function()
		if istAus(btn) then
			return
		end
		spiele(HOVER)
		if skala then
			tween(skala, 0.15, { Scale = 1.04 })
		end
	end)
	btn.MouseLeave:Connect(function()
		if skala then
			tween(skala, 0.15, { Scale = 1 })
		end
	end)
	btn.Activated:Connect(function()
		if istAus(btn) then
			return
		end
		spiele(KLICK)
		if skala then
			tween(skala, 0.06, { Scale = 0.94 }).Completed:Once(function()
				tween(skala, 0.2, { Scale = 1 }, Enum.EasingStyle.Back)
			end)
		end
		if beiKlick then
			task.spawn(beiKlick)
		end
	end)
end
local function setAus(btn, aus)
	if not btn then
		return
	end
	if btn:GetAttribute("TSGInit") and btn:GetAttribute("TSGAus") == aus then
		return
	end
	btn:SetAttribute("TSGInit", true)
	btn:SetAttribute("TSGAus", aus)
	btn.AutoButtonColor = false
	tween(btn, 0.2, { BackgroundColor3 = aus and DUNKEL or GRUEN, BackgroundTransparency = aus and 0.6 or 0.2 })
	for _, d in ipairs(btn:GetDescendants()) do
		if d:IsA("TextLabel") then
			tween(d, 0.2, { TextTransparency = aus and 0.5 or 0 })
		elseif d:IsA("ImageLabel") then
			tween(d, 0.2, { ImageTransparency = aus and 0.6 or 0 })
		end
	end
end

-- ===== Meldungen (container.notify) =====
local notifyVorlage = notify and notify:FindFirstChild("Frame")
if notifyVorlage then
	notifyVorlage.Visible = false
	notify.ZIndex = 50
end
local function melden(text, art)
	if not notifyVorlage then
		warn("[TSG] " .. tostring(text))
		return
	end
	notify.Visible = true
	local f = notifyVorlage:Clone()
	f.Name = "TSGMeldung"
	local label = f:FindFirstChildOfClass("TextLabel")
	local bild = f:FindFirstChildOfClass("ImageLabel")
	local bg = f.BackgroundTransparency
	if label then
		label.RichText = true
		label.Text = text
		label.TextTransparency = 1
	end
	if bild then
		bild.ImageColor3 = art == "ok" and GRUEN or art == "fehler" and ROT or WEISS
		bild.ImageTransparency = 1
	end
	f.BackgroundTransparency = 1
	local skala = Instance.new("UIScale")
	skala.Scale = 0.85
	skala.Parent = f
	f.Visible = true
	f.Parent = notify
	tween(f, 0.25, { BackgroundTransparency = bg })
	tween(skala, 0.35, { Scale = 1 }, Enum.EasingStyle.Back)
	if label then
		tween(label, 0.25, { TextTransparency = 0 })
	end
	if bild then
		tween(bild, 0.25, { ImageTransparency = 0 })
	end
	task.delay(4.5, function()
		tween(f, 0.3, { BackgroundTransparency = 1 })
		tween(skala, 0.3, { Scale = 0.9 })
		if label then
			tween(label, 0.3, { TextTransparency = 1 })
		end
		if bild then
			tween(bild, 0.3, { ImageTransparency = 1 })
		end
		task.wait(0.32)
		f:Destroy()
	end)
end

-- ===== Zeit (deutsche Zeit wie in der App) =====
local versatz = 0
local function jetzt()
	return os.time() + versatz
end
local function tage(y, m, d)
	y = m <= 2 and y - 1 or y
	local era = y // 400
	local yoe = y - era * 400
	local mp = (m + 9) % 12
	local doy = (153 * mp + 2) // 5 + d - 1
	local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
	return era * 146097 + doe - 719468
end
local function letzterSonntag(y, m)
	local t = tage(y, m, 31)
	return t - (t + 4) % 7
end
local function berlin(t)
	local y = os.date("!*t", t).year
	local sommer = t >= letzterSonntag(y, 3) * 86400 + 3600 and t < letzterSonntag(y, 10) * 86400 + 3600
	return os.date("!*t", t + (sommer and 7200 or 3600))
end
local function datum(t)
	local d = berlin(t or 0)
	return string.format("%02d.%02d.%04d — %02d:%02d", d.day, d.month, d.year, d.hour, d.min)
end
local function bis(sek)
	if sek < 3600 then
		return math.max(1, math.ceil(sek / 60)) .. " min"
	elseif sek < 86400 then
		return math.floor(sek / 3600) .. " h"
	elseif sek < 7 * 86400 then
		return math.floor(sek / 86400) .. " d"
	end
	return math.floor(sek / (7 * 86400)) .. " w"
end
local function rest(sek)
	sek = math.max(0, math.floor(sek))
	local d, h, m, s = sek // 86400, (sek % 86400) // 3600, (sek % 3600) // 60, sek % 60
	if d > 0 then
		return string.format("%dd %02dh %02dm", d, h, m)
	elseif h > 0 then
		return string.format("%dh %02dm %02ds", h, m, s)
	end
	return string.format("%dm %02ds", m, s)
end

-- ===== Zustand =====
local z = nil
local aktuell = nil
local laden, beitreten, zeige -- weiter unten
local startPos = {}
for _, f in pairs(F) do
	startPos[f] = f.Position
	f.Visible = false
end

local function theorieBestanden()
	return z ~= nil and z.Theorie ~= nil and z.Theorie.Status == "bestanden"
end
local function leitung()
	return z ~= nil and z.Praktisch ~= nil and z.Praktisch.Leitung == true
end
local function erlaubt(name)
	if not z or z.Fehler then
		return name == "Anforderungen"
	end
	if name == "Anforderungen" then
		return true
	elseif name == "Theorie" then
		return not z.KeinTraining and (z.AnforderungenFertig == true or theorieBestanden())
	end
	return theorieBestanden() or leitung()
end
local function fertig(name)
	if not z or z.KeinTraining or z.Fehler then
		return false
	end
	if name == "Anforderungen" then
		return z.AnforderungenFertig == true or theorieBestanden()
	elseif name == "Theorie" then
		return theorieBestanden()
	end
	return false
end
local function startSektion()
	if not z or z.Fehler then
		return "Anforderungen"
	end
	if z.KeinTraining then
		return leitung() and "Assessment" or "Anforderungen"
	end
	if theorieBestanden() then
		return "Assessment"
	end
	return z.AnforderungenFertig and "Theorie" or "Anforderungen"
end
local function rangText(name, kuerzel, farbe)
	return string.format("%s Training — From <font color='%s'>%s</font>", esc(name), farbe or "#ffffff", esc(kuerzel))
end
local SCHRIFT
local function hinweis(parent, name, layout)
	local l = parent:FindFirstChild(name)
	if not l then
		l = Instance.new("TextLabel")
		l.Name = name
		l.BackgroundTransparency = 1
		l.Size = UDim2.new(1, 0, 0, 0)
		l.AutomaticSize = Enum.AutomaticSize.Y
		l.TextWrapped = true
		l.RichText = true
		l.TextXAlignment = Enum.TextXAlignment.Left
		l.TextColor3 = WEISS
		l.TextSize = 24
		l.FontFace = SCHRIFT or Font.fromEnum(Enum.Font.BuilderSans)
		l.LayoutOrder = layout or 0
		l.Parent = parent
	end
	return l
end

-- ===== Top: 3 Abschnitte =====
local SEKTOR = { Anforderungen = Top:FindFirstChild("selector"), Theorie = Top:FindFirstChild("quiz"), Assessment = Top:FindFirstChild("practical") }
local function topSetzen()
	local aktiverSektor = aktuell == "Calender" and "Assessment" or aktuell
	for name, cg in pairs(SEKTOR) do
		local ok = fertig(name)
		tween(cg, 0.25, { BackgroundColor3 = ok and GRUEN or DUNKEL, BackgroundTransparency = 0.2 })
		local btn = cg:FindFirstChild("Btn")
		local sel = btn and btn:FindFirstChild("selected")
		local ic = sel and sel:FindFirstChild("icon")
		if ic then
			ic.Visible = ok
		end
		if sel then
			tween(sel, 0.25, { BackgroundColor3 = ok and DUNKEL or GRAU, BackgroundTransparency = ok and 0.2 or 0.6 })
		end
		local h = btn and btn:FindFirstChild("heading")
		if h then
			tween(h, 0.25, { TextColor3 = ok and TEXT_DUNKEL or WEISS, TextTransparency = erlaubt(name) and 0 or 0.45 })
		end
		local st = cg:FindFirstChild("stroke") or cg:FindFirstChildOfClass("UIStroke")
		if not st then
			st = Instance.new("UIStroke")
			st.Name = "stroke"
			st.Thickness = 1.5
			st.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
			st.Parent = cg
		end
		st.Color = ok and WEISS or GRUEN
		st.Enabled = aktiverSektor == name
	end
end

-- ===== Unten: Return, Guides, Kalender, Next =====
local unten = bottom:FindFirstChild("Frame")
local nextBtn = unten and unten:FindFirstChild("Next")
local nextText = nextBtn and nextBtn:FindFirstChildOfClass("TextLabel")
local guides = unten and unten:FindFirstChild("Guides")
local kalBtn = unten and kind(unten, "calender", "Calender")
local zurueck = bottom:FindFirstChild("return")

local function meinTraining()
	if not z or not z.Praktisch then
		return nil
	end
	for _, tr in ipairs(z.Praktisch.Trainings or {}) do
		if tr.Meins then
			return tr
		end
	end
	return nil
end
local function istOffen(tr)
	local t = jetzt()
	return tr ~= nil and t >= tr.Start - ((z and z.JoinVorher) or 900) and t < tr.Start + tr.Dauer * 60
end
local function darf(tr)
	if not tr then
		return false
	end
	if tr.HostId == player.UserId or tr.Meins then
		return true
	end
	for _, h in ipairs(tr.Helfer or {}) do
		if h.Id == player.UserId then
			return true
		end
	end
	return false
end
local function untenSetzen()
	local imAssessment = aktuell == "Assessment"
	if guides then
		guides.Visible = imAssessment
	end
	if kalBtn then
		kalBtn.Visible = imAssessment
	end
	if not nextBtn then
		return
	end
	if aktuell == "Anforderungen" and erlaubt("Theorie") then
		nextBtn.Visible = true
		if nextText then
			nextText.Text = theorieBestanden() and "Practical Training →" or "Start Theory →"
		end
		setAus(nextBtn, false)
	elseif imAssessment then
		nextBtn.Visible = true
		if nextText then
			nextText.Text = "Join Assessment →"
		end
		local tr = meinTraining()
		setAus(nextBtn, not (tr and istOffen(tr) and darf(tr)))
	else
		nextBtn.Visible = false
	end
end

-- ===== 1. Anforderungen =====
local A = F.Anforderungen
local aKopf = A and A:FindFirstChild("Heading")
local aRang = aKopf and aKopf:FindFirstChild("Rank")
local aListe = A and kind(A, "conent", "content")
local reqVorlage
if aListe then
	for _, c in ipairs(aListe:GetChildren()) do
		if c:IsA("CanvasGroup") and (not reqVorlage or (not reqVorlage:FindFirstChild("Frame") and c:FindFirstChild("Frame"))) then
			reqVorlage = c
		end
	end
	reqVorlage = reqVorlage and reqVorlage:Clone()
	for _, c in ipairs(aListe:GetChildren()) do
		if c:IsA("CanvasGroup") then
			c:Destroy()
		end
	end
end
local reqZeilen = {}

local function gruppeBeitreten()
	if not z then
		return
	end
	local ok, status = pcall(GroupService.PromptJoinAsync, GroupService, z.GruppenId)
	if ok and tostring(status):find("Joined") then
		melden("Welcome to the Train Sim Germany group!", "ok")
	end
	task.wait(1)
	laden(true)
	task.wait(5)
	laden(true) -- Roblox meldet den Beitritt manchmal etwas später
end
local function gruppenKnopf(r)
	if r.gruppe then
		return r.gruppe
	end
	local b = Instance.new("TextButton")
	b.Name = "TSGJoinGroup"
	b.AnchorPoint = Vector2.new(1, 0.5)
	b.Position = UDim2.new(1, -12, 0.5, 0)
	b.Size = UDim2.fromOffset(140, 34)
	b.BackgroundColor3 = Color3.fromHex("EC0016")
	b.AutoButtonColor = false
	b.Text = "Join Group"
	b.TextColor3 = WEISS
	b.TextSize = 18
	b.FontFace = r.text and Font.new(r.text.FontFace.Family, Enum.FontWeight.Bold) or Font.fromEnum(Enum.Font.BuilderSansBold)
	b.ZIndex = 20
	local ecke = Instance.new("UICorner")
	ecke.CornerRadius = UDim.new(0, 10)
	ecke.Parent = b
	b.Parent = r.row
	knopf(b, gruppeBeitreten)
	r.gruppe = b
	return b
end
local function reqZeile(i)
	local r = reqZeilen[i]
	if r then
		return r
	end
	local row = reqVorlage:Clone()
	row.Name = "Anforderung" .. i
	row.LayoutOrder = i
	local text = row:FindFirstChild("A1") or row:FindFirstChildWhichIsA("GuiButton")
	local box = text and text:FindFirstChild("ImageLabel")
	local bild = box and (box:IsA("ImageLabel") and box or box:FindFirstChildOfClass("ImageLabel"))
	local balken = row:FindFirstChild("Frame")
	if not balken then
		balken = Instance.new("Frame")
		balken.Name = "Frame"
		balken.BorderSizePixel = 0
		balken.BackgroundColor3 = ROT
		balken.Parent = row
	end
	balken.Size = UDim2.fromScale(0, 1)
	if text then
		text.RichText = true
		text.AutoButtonColor = false
	end
	r = { row = row, text = text, bild = bild, balken = balken }
	if text then
		knopf(text, function()
			if r.aktion == "gruppe" then
				gruppeBeitreten()
			end
		end, true)
	end
	row.Parent = aListe
	reqZeilen[i] = r
	return r
end
local function anforderungenZeigen(animieren)
	if not A or not z or not aListe or not reqVorlage then
		return
	end
	local info = hinweis(aListe, "TSGHinweis", 100)
	if aRang then
		aRang.RichText = true
	end
	if z.KeinTraining then
		if aRang then
			aRang.Text = string.format("No further training — your rank: <font color='%s'>%s</font>", z.Rang.Farbe, esc(z.Rang.Name))
		end
		for _, r in ipairs(reqZeilen) do
			r.row.Visible = false
		end
		info.Visible = true
		info.Text = leitung() and "You are hosting a training – open <b>Practical Training</b> to join its server." or "You have completed all trainings. Thank you for being part of the team!"
		return
	end
	info.Visible = false
	if aRang then
		aRang.Text = rangText(z.Ziel.Name, z.Rang.Kuerzel, z.Rang.Farbe)
	end
	local liste = z.Anforderungen or {}
	for i, a in ipairs(liste) do
		local r = reqZeile(i)
		r.row.Visible = true
		r.aktion = a.Aktion
		if r.text then
			r.text.Text = esc(a.Text) .. (a.Anzeige and ("  <font color='#b2b9c4'>· " .. esc(a.Anzeige) .. "</font>") or "")
		end
		if r.bild then
			r.bild.Image = a.Fertig and HAKEN or OFFEN_BILD
		end
		-- Roter Balken wächst von links nach rechts bis zum Fortschritt (XP bzw. Zeit), fertig = grün
		if animieren then
			r.balken.Size = UDim2.fromScale(0, 1)
		end
		tween(r.balken, animieren and 1 or 0.5, { Size = UDim2.fromScale(math.clamp(tonumber(a.Wert) or 0, 0, 1), 1), BackgroundColor3 = a.Fertig and GRUEN_BALKEN or ROT },
			Enum.EasingStyle.Quint, Enum.EasingDirection.Out, animieren and (0.1 + i * 0.12) or 0)
		local g = a.Aktion == "gruppe" and gruppenKnopf(r) or r.gruppe
		if g then
			g.Visible = a.Aktion == "gruppe"
		end
	end
	for i = #liste + 1, #reqZeilen do
		reqZeilen[i].row.Visible = false
	end
end

-- ===== 2. Theorie =====
local T = F.Theorie
local tInfo, tAbsenden
local vorlagen = {}
local fragenFrames, antwortListe, gebautId = {}, {}, nil
if T then
	T.Size = UDim2.new(1, 0, 0, 0)
	T.AutomaticSize = Enum.AutomaticSize.Y
	for _, c in ipairs(T:GetChildren()) do
		if c:IsA("TextLabel") and not tInfo then
			tInfo = c
		end
	end
	tAbsenden = T:FindFirstChild("TextButton") -- Zeile mit „Submit Quiz“ und „← Return“
	local q = {}
	for _, c in ipairs(T:GetChildren()) do
		if c:IsA("Frame") and c.Name:match("^Q%d+$") then
			q[tonumber(c.Name:sub(2))] = c
		end
	end
	local function hatBox(f)
		return f ~= nil and f:FindFirstChildWhichIsA("TextBox", true) ~= nil
	end
	local function hatKnoepfe(f)
		return f ~= nil and f:FindFirstChildOfClass("TextButton") ~= nil
	end
	vorlagen.Auswahl = hatKnoepfe(q[1]) and q[1] or nil
	vorlagen.Mehrfach = (hatKnoepfe(q[10]) and q[10]) or (hatKnoepfe(q[2]) and q[2]) or nil
	vorlagen.Text = hatBox(q[3]) and q[3] or nil
	for _, f in pairs(q) do
		if hatBox(f) then
			vorlagen.Text = vorlagen.Text or f
		elseif hatKnoepfe(f) then
			vorlagen.Auswahl = vorlagen.Auswahl or f
			vorlagen.Mehrfach = vorlagen.Mehrfach or f
		end
	end
	for k, f in pairs(vorlagen) do
		vorlagen[k] = f:Clone()
	end
	for _, f in pairs(q) do
		f:Destroy()
	end
	if tInfo then
		tInfo.LayoutOrder = 1
		tInfo.RichText = true
		tInfo.TextWrapped = true
		tInfo.AutomaticSize = Enum.AutomaticSize.Y
		SCHRIFT = tInfo.FontFace
	end
	if tAbsenden then
		tAbsenden.LayoutOrder = 100
	end
end
local submitKnopf = tAbsenden and tAbsenden:FindFirstChildOfClass("TextButton")
local tZurueck = tAbsenden and tAbsenden:FindFirstChild("return")

local function wahlZeigen(e)
	for k, kb in pairs(e.knoepfe) do
		local an = e.wahl[k] == true
		tween(kb.b, 0.15, { BackgroundColor3 = an and GRUEN or SCHWARZ, BackgroundTransparency = an and 0.82 or 1, TextColor3 = an and GRUEN or WEISS })
		if kb.bild then
			tween(kb.bild, 0.15, { ImageColor3 = an and GRUEN or WEISS })
		end
	end
end
local function fragenBauen(th)
	for _, f in ipairs(fragenFrames) do
		f:Destroy()
	end
	fragenFrames, antwortListe = {}, {}
	gebautId = th.Id
	for i, q in ipairs(th.Fragen or {}) do
		local v = vorlagen[q.Typ] or vorlagen.Auswahl
		if v then
			local f = v:Clone()
			f.Name = "Q" .. i
			f.LayoutOrder = 10 + i
			f.AutomaticSize = Enum.AutomaticSize.Y
			f.Size = UDim2.new(1, 0, 0, 0)
			local kopf
			for _, c in ipairs(f:GetChildren()) do
				if c:IsA("Frame") and c:FindFirstChildOfClass("TextLabel") and not c:FindFirstChildWhichIsA("TextBox", true) then
					kopf = c
					break
				end
			end
			local label = kopf and kopf:FindFirstChildOfClass("TextLabel")
			if kopf then
				kopf.AutomaticSize = Enum.AutomaticSize.Y
			end
			if label then
				label.RichText = true
				label.TextWrapped = true
				label.AutomaticSize = Enum.AutomaticSize.Y
				local extra = q.Typ == "Mehrfach" and " <font color='#b2b9c4'>(select all that apply)</font>" or ""
				label.Text = string.format("<font color='#ff0000'>Question %d</font> | %s%s <font color='#8a8f9a'>· %d %s</font>", i, esc(q.Text), extra, q.Punkte, q.Punkte == 1 and "pt" or "pts")
			end
			local eintrag = { typ = q.Typ, wahl = {}, knoepfe = {} }
			if q.Typ == "Text" then
				local box = f:FindFirstChildWhichIsA("TextBox", true)
				if box then
					box.Text = ""
					box.PlaceholderText = "Type your answer …"
					box.ClearTextOnFocus = false
					box.Focused:Connect(function()
						spiele(HOVER)
					end)
					eintrag.box = box
				end
			else
				local muster
				for _, c in ipairs(f:GetChildren()) do
					if c:IsA("TextButton") then
						muster = muster or c
						c.Parent = nil
					end
				end
				for k, text in ipairs(q.Optionen or {}) do
					if muster then
						local b = muster:Clone()
						b.Name = "A" .. k
						b.Text = text
						b.LayoutOrder = k
						b.AutoButtonColor = false
						b.Parent = f
						eintrag.knoepfe[k] = { b = b, bild = b:FindFirstChildOfClass("ImageLabel") }
						knopf(b, function()
							if q.Typ == "Auswahl" then
								eintrag.wahl = { [k] = true }
							else
								eintrag.wahl[k] = (not eintrag.wahl[k]) or nil
							end
							wahlZeigen(eintrag)
						end, true)
					end
				end
				if muster then
					muster:Destroy()
				end
			end
			f.Parent = T
			table.insert(fragenFrames, f)
			antwortListe[i] = eintrag
		end
	end
end

local nachgeladen = nil
local function theorieText()
	if not tInfo or not z then
		return
	end
	local th = z.Theorie or {}
	local klein = "<font size='20' color='#b2b9c4'>%s</font>"
	if z.KeinTraining then
		tInfo.Text = "<b>No theory for your rank</b><br/>" .. string.format(klein, "You have already completed all trainings.")
	elseif th.Status == "offen" then
		tInfo.Text = string.format("<b>Theory Quiz — %s</b><br/>", esc(z.Ziel.Name))
			.. string.format(klein, string.format("Answer all %d questions about your next rank. You need at least %d %% of the points to pass.", #(th.Fragen or {}), math.floor((z.Grenze or 0.9) * 100 + 0.5)))
	elseif th.Status == "sperre" then
		local s = (th.Bis or 0) - jetzt()
		if s <= 0 and nachgeladen ~= th.Bis then
			nachgeladen = th.Bis
			task.spawn(laden)
		end
		tInfo.Text = string.format("<b>You did not pass the theory%s.</b><br/>Next attempt in <font color='#ff2929'>%s</font><br/>", th.Prozent and (" (" .. th.Prozent .. " %)") or "", rest(s))
			.. string.format(klein, "on " .. datum(th.Bis or 0))
	elseif th.Status == "bestanden" then
		tInfo.Text = string.format("<b>Theory passed <font color='#00ff5e'>✓</font></b>%s<br/>", th.Prozent and (" (" .. th.Prozent .. " %)") or "")
			.. string.format(klein, "Continue with the practical training.")
	else
		tInfo.Text = "<b>Theory locked</b><br/>" .. string.format(klein, "Complete all requirements first.")
	end
end
local function theorieZeigen()
	if not T or not z then
		return
	end
	local th = z.Theorie or {}
	local offen = not z.KeinTraining and th.Status == "offen"
	if offen and th.Id ~= gebautId then
		fragenBauen(th)
	end
	-- Gesperrt, bestanden oder Sperrfrist: Fragen ausblenden, nur das TextLabel (LayoutOrder 1) bleibt sichtbar
	for _, f in ipairs(fragenFrames) do
		f.Visible = offen
	end
	if tAbsenden then
		tAbsenden.Visible = offen
	end
	theorieText()
end

local sendet = false
local function absenden()
	if sendet or not z or not z.Theorie or z.Theorie.Status ~= "offen" then
		return
	end
	local antworten, fehlt = {}, 0
	for i, e in ipairs(antwortListe) do
		if e.typ == "Text" then
			local s = e.box and e.box.Text:match("^%s*(.-)%s*$") or ""
			if s == "" then
				fehlt += 1
			else
				antworten[tostring(i)] = s
			end
		elseif e.typ == "Auswahl" then
			local k = next(e.wahl)
			if k then
				antworten[tostring(i)] = k
			else
				fehlt += 1
			end
		else
			local l = {}
			for k in pairs(e.wahl) do
				table.insert(l, k)
			end
			table.sort(l)
			if #l == 0 then
				fehlt += 1
			else
				antworten[tostring(i)] = l
			end
		end
	end
	if fehlt > 0 then
		melden(string.format("Please answer all questions (%d still open).", fehlt), "fehler")
		return
	end
	sendet = true
	local altText = submitKnopf and submitKnopf.Text
	if submitKnopf then
		submitKnopf.Text = "Checking …"
	end
	local ok, res = pcall(rAbsenden.InvokeServer, rAbsenden, z.Theorie.Id, antworten)
	sendet = false
	if submitKnopf then
		submitKnopf.Text = altText
	end
	if not ok or type(res) ~= "table" then
		melden("Could not submit – please try again.", "fehler")
		return
	end
	if res.Ok == false then
		melden(esc(res.Text or "Could not submit."), "fehler")
		laden()
		return
	end
	if res.Bestanden then
		melden(string.format("Theory passed with <b>%d %%</b>! You are <b>#%s</b> in the queue.", res.Prozent, tostring(res.Nummer or "?")), "ok")
		laden(false, "Assessment")
	else
		melden(string.format("Not passed (%d %%, you need %d %%). Next attempt on %s.", res.Prozent, math.floor((z.Grenze or 0.9) * 100 + 0.5), datum(res.Bis)), "fehler")
		laden()
	end
end

-- ===== 3. Praktisch (Assessment) =====
local P = F.Assessment
local pKopf = P and P:FindFirstChild("Heading")
local pRang = pKopf and pKopf:FindFirstChild("Rank")
local pInhalt = P and kind(P, "conent", "content")
local pText = pInhalt and pInhalt:FindFirstChildOfClass("TextLabel")
local tags = pInhalt and pInhalt:FindFirstChild("Tags")
local hostBox = pInhalt and pInhalt:FindFirstChild("HosterContainer")
local tag = {}
if tags then
	for _, t in ipairs(tags:GetChildren()) do
		if t:IsA("Frame") then
			local ecke = t:FindFirstChildOfClass("UICorner")
			local l = t:FindFirstChildOfClass("TextLabel")
			if ecke and ecke.CornerRadius.Scale >= 0.5 then
				tag.Status = t
			elseif l and l.Text:lower():find("player") then
				tag.Spieler = t
			elseif not tag.Rang then
				tag.Rang = t
			end
		end
	end
	if tag.Spieler then
		tag.Warteschlange = tag.Spieler:Clone()
		tag.Warteschlange.Name = "Warteschlange"
		tag.Warteschlange.Parent = tags
	end
	for i, n in ipairs({ "Rang", "Spieler", "Warteschlange", "Status" }) do
		local t = tag[n]
		if t then
			t.Name = "Tag" .. n
			t.LayoutOrder = i
			local breite = math.max(60, t.Size.X.Offset)
			t.AutomaticSize = Enum.AutomaticSize.X
			local l = t:FindFirstChildOfClass("TextLabel")
			if l then
				l.AnchorPoint = Vector2.zero
				l.Position = UDim2.new()
				l.Size = UDim2.new(0, breite, 1, 0)
				l.AutomaticSize = Enum.AutomaticSize.X
				l.TextXAlignment = Enum.TextXAlignment.Center
			end
		end
	end
end
local function tagSetzen(t, text, farbe, transparenz)
	if not t then
		return
	end
	local l = t:FindFirstChildOfClass("TextLabel")
	if l and l.Text ~= text then
		l.Text = text
	end
	if farbe and (t.BackgroundColor3 ~= farbe or (transparenz and t.BackgroundTransparency ~= transparenz)) then
		tween(t, 0.25, { BackgroundColor3 = farbe, BackgroundTransparency = transparenz or t.BackgroundTransparency })
	end
end

local profilHost, profilHelfer
local helferFrames = {}
if hostBox then
	profilHost = hostBox:FindFirstChild("Profil1")
	local p2 = hostBox:FindFirstChild("Profil2")
	profilHelfer = p2 and p2:Clone()
	for _, c in ipairs(hostBox:GetChildren()) do
		if c:IsA("Frame") and c ~= profilHost then
			c:Destroy()
		end
	end
end
local function profilSetzen(profil, userId, randFarbe)
	local img = profil:FindFirstChildOfClass("ImageLabel")
	if img then
		img.Image = thumb(userId)
	end
	local rand = profil:FindFirstChildOfClass("UIStroke")
	if rand then
		rand.Color = randFarbe
	end
end
local function hostsZeigen(tr)
	if not hostBox then
		return
	end
	hostBox.Visible = tr ~= nil
	if not tr then
		return
	end
	if profilHost then
		profilHost.Visible = tr.HostId ~= nil
		profilSetzen(profilHost, tr.HostId, ROT) -- Leitung: rot
	end
	local helfer = tr.Helfer or {}
	for i, h in ipairs(helfer) do
		local f = helferFrames[i]
		if not f and profilHelfer then
			f = profilHelfer:Clone()
			f.Name = "Supervisor" .. i
			f.LayoutOrder = 1 + i
			f.Parent = hostBox
			helferFrames[i] = f
		end
		if f then
			f.Visible = true
			profilSetzen(f, h.Id, SCHWARZ) -- Supervisors: schwarz
		end
	end
	for i = #helfer + 1, #helferFrames do
		helferFrames[i].Visible = false
	end
end

local function assessmentText()
	if not pText or not z then
		return
	end
	pText.RichText = true
	local klein = "<font size='24' color='#b2b9c4'>%s</font>"
	local tr = meinTraining()
	if z.KeinTraining and not leitung() then
		pText.Text = "No practical training for your rank."
		return
	end
	if not theorieBestanden() and not leitung() then
		pText.Text = "Pass the theory first."
		return
	end
	if tr then
		local s = tr.Start - jetzt()
		local wann
		if istOffen(tr) then
			wann = s > 0 and string.format("Server <font color='#00ff5e'>open</font> — starting in <font color='#ff0000'>%s</font>", bis(s))
				or "Server <font color='#00ff5e'>open</font> — the training is running"
		else
			wann = string.format("Starting in <font color='#ff0000'>%s</font>", bis(s))
		end
		local titel = tr.Titel ~= "" and tr.Titel or ((tr.Ziel or "") .. " Training")
		pText.Text = string.format("%s <b>%s</b><br/>%s<br/>", leitung() and "You are hosting:" or "Next Training Session:", esc(titel), wann)
			.. string.format(klein, datum(tr.Start) .. (tr.Server ~= "" and (" · " .. esc(tr.Server)) or ""))
	else
		local nr = z.Praktisch and z.Praktisch.Nummer
		pText.Text = "No training assigned yet.<br/>"
			.. string.format(klein, string.format("You are <b>#%s</b> in the queue – you will be assigned to the next %s training with a free place automatically.", tostring(nr or "?"), esc(z.Ziel and z.Ziel.Name or "")))
	end
end
local function statusTag()
	local tr = meinTraining()
	local offen = istOffen(tr)
	tagSetzen(tag.Status, offen and "Open" or "Closed", offen and GRUEN or SCHWARZ, offen and 0.2 or 0.8)
end
local function assessmentZeigen()
	if not P or not z then
		return
	end
	local tr = meinTraining()
	local zielName = (z.Ziel and z.Ziel.Name) or (tr and tr.Ziel) or "Training"
	local zielFarbe = (z.Ziel and z.Ziel.Farbe) or (tr and tr.ZielFarbe) or "#878C96"
	if pRang then
		pRang.RichText = true
		pRang.Text = z.Ziel and rangText(z.Ziel.Name, z.Rang.Kuerzel, z.Rang.Farbe) or string.format("Your rank: <font color='%s'>%s</font>", z.Rang.Farbe, esc(z.Rang.Name))
	end
	tagSetzen(tag.Rang, zielName, Color3.fromHex(zielFarbe), 0.1)
	tagSetzen(tag.Spieler, tr and string.format("%d/%d Players", tr.Belegt, tr.Plaetze) or "– Players")
	local nr = z.Praktisch and z.Praktisch.Nummer
	if tag.Warteschlange then
		tag.Warteschlange.Visible = nr ~= nil
		tagSetzen(tag.Warteschlange, nr and ("#" .. nr) or "")
	end
	statusTag()
	hostsZeigen(tr)
	assessmentText()
end

-- ===== Kalender =====
local C = F.Calender
local cKopf = C and C:FindFirstChild("Heading")
local cTitel = cKopf and cKopf:FindFirstChildOfClass("TextLabel")
local cListe = C and kind(C, "conent", "content")
local calVorlage
if cListe then
	calVorlage = cListe:FindFirstChildOfClass("CanvasGroup")
	calVorlage = calVorlage and calVorlage:Clone()
	for _, c in ipairs(cListe:GetChildren()) do
		if c:IsA("CanvasGroup") then
			c:Destroy()
		end
	end
end
local calZeilen = {}
local function joinZustand(r)
	if not r.join then
		return
	end
	local an = r.tr ~= nil and darf(r.tr) and istOffen(r.tr)
	if r.join:GetAttribute("TSGInit") and r.join:GetAttribute("TSGAus") == not an then
		return
	end
	r.join:SetAttribute("TSGInit", true)
	r.join:SetAttribute("TSGAus", not an)
	tween(r.join, 0.2, { BackgroundColor3 = an and GRUEN or DUNKEL, BackgroundTransparency = an and 0.2 or 0.6 })
	local img = r.join:FindFirstChildOfClass("ImageLabel")
	if img then
		tween(img, 0.2, { ImageTransparency = an and 0 or 0.6 })
	end
end
local function calZeit(r)
	local tr = r.tr
	if not tr or not r.zeit then
		return
	end
	local s = tr.Start - jetzt()
	local wann = istOffen(tr) and (s > 0 and ("open · in " .. bis(s)) or "running") or ("in " .. bis(s))
	local vorne = tr.Meins and (leitung() and "hosting " or "zugewiesen ") or ""
	local text = string.format("%s%s <font color='%s'>(%s)</font>", vorne, datum(tr.Start), tr.Meins and "#00ff5e" or "#b2b9c4", wann)
	if r.zeit.Text ~= text then
		r.zeit.Text = text
	end
end
local function calZeile(tr)
	local r = calZeilen[tr.Id]
	if r then
		return r
	end
	local row = calVorlage:Clone()
	row.Name = "Training_" .. tr.Id
	local btn = row:FindFirstChild("Btn")
	r = { row = row }
	if btn then
		for _, c in ipairs(btn:GetChildren()) do
			if c.Name == "profilCanvas" then
				if c:FindFirstChildOfClass("ImageLabel") then
					r.avatar = c:FindFirstChildOfClass("ImageLabel")
				else
					r.kuerzel = c:FindFirstChildOfClass("TextLabel")
				end
			elseif c:IsA("TextLabel") then
				if c.Position.X.Scale >= 0.5 then
					r.zeit = c
				else
					r.name = c
				end
			end
		end
		r.join = btn:FindFirstChild("Join")
		knopf(btn, function()
			local t = r.tr
			if t then
				melden(string.format("<b>%s</b> · %s · %d/%d Players%s", esc(t.Titel ~= "" and t.Titel or "Training"), esc(t.HostName), t.Belegt, t.Plaetze, t.Server ~= "" and (" · " .. esc(t.Server)) or ""), "info")
			end
		end, true)
		if r.join then
			knopf(r.join, function()
				if r.tr then
					beitreten(r.tr.Id)
				end
			end)
		end
	end
	if r.zeit then
		r.zeit.RichText = true
		r.zeit.AutomaticSize = Enum.AutomaticSize.X
		r.zeit.TextXAlignment = Enum.TextXAlignment.Right
	end
	r.rand = Instance.new("UIStroke")
	r.rand.Color = GRUEN
	r.rand.Thickness = 1.5
	r.rand.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	r.rand.Enabled = false
	r.rand.Parent = row
	row.Parent = cListe
	calZeilen[tr.Id] = r
	return r
end
local function kalenderZeigen()
	if not C or not z or not cListe then
		return
	end
	local zielName = (z.Ziel and z.Ziel.Name) or "Your"
	local zielFarbe = (z.Ziel and z.Ziel.Farbe) or "#ffff7f"
	if cTitel then
		cTitel.RichText = true
		cTitel.Text = string.format("Upcoming Trainings <font color='%s'>%s Trainings</font>", zielFarbe, esc(zielName))
	end
	local liste = (z.Praktisch and z.Praktisch.Trainings) or {}
	local gesehen = {}
	if calVorlage then
		for i, tr in ipairs(liste) do
			local r = calZeile(tr)
			r.tr = tr
			gesehen[tr.Id] = true
			r.row.LayoutOrder = i -- das zugewiesene Training steht ganz oben
			if r.avatar then
				r.avatar.Image = thumb(tr.HostId)
			end
			if r.kuerzel then
				r.kuerzel.Text = tr.HostKuerzel or "?"
				r.kuerzel.BackgroundColor3 = Color3.fromHex(tr.HostFarbe or "#878C96")
			end
			if r.name then
				r.name.Text = tr.HostName ~= "" and tr.HostName or "Unknown host"
			end
			r.rand.Enabled = tr.Meins == true
			calZeit(r)
			joinZustand(r)
		end
	end
	for id, r in pairs(calZeilen) do
		if not gesehen[id] then
			r.row:Destroy()
			calZeilen[id] = nil
		end
	end
	local leer = hinweis(cListe, "TSGLeer", 1000)
	leer.Visible = #liste == 0
	leer.Text = (z.Praktisch and z.Praktisch.AppFehler) and "Trainings could not be loaded from the app – please try again later."
		or string.format("No upcoming %s trainings yet. New dates appear here as soon as they are offered in the app.", esc(zielName))
end

-- ===== Join =====
beitreten = function(id)
	if not id then
		return
	end
	local ok, res = pcall(rBeitreten.InvokeServer, rBeitreten, id)
	if not ok or type(res) ~= "table" then
		melden("Join failed – please try again.", "fehler")
		return
	end
	melden(esc(res.Text or ""), res.Ok and "ok" or "fehler")
end

-- ===== Abschnitte wechseln =====
zeige = function(name, richtung)
	local f = F[name]
	if not f then
		return
	end
	if not erlaubt(name) then
		melden(name == "Theorie" and "Complete all requirements first." or "Pass the theory first.", "fehler")
		return
	end
	richtung = richtung or 1
	local alt = aktuell
	aktuell = name
	for _, x in pairs(F) do
		if x ~= f then
			x.Visible = false
			x.Position = startPos[x]
		end
	end
	if alt ~= name or not f.Visible then
		f.Position = startPos[f] + UDim2.fromOffset(60 * richtung, 0)
		f.Visible = true
		tween(f, 0.35, { Position = startPos[f] })
		items.CanvasPosition = Vector2.zero
	end
	if name == "Anforderungen" then
		anforderungenZeigen(true)
	end
	topSetzen()
	untenSetzen()
end

-- ===== Laden =====
local laedt = false
laden = function(frisch, sektion)
	if laedt then
		return
	end
	laedt = true
	local ok, res = pcall(rZustand.InvokeServer, rZustand, frisch == true)
	laedt = false
	if not ok or type(res) ~= "table" or res.Fehler then
		melden("Training data could not be loaded – please try again.", "fehler")
		if not aktuell then
			zeige("Anforderungen")
		end
		return
	end
	z = res
	versatz = (z.Jetzt or os.time()) - os.time()
	anforderungenZeigen(false)
	theorieZeigen()
	assessmentZeigen()
	kalenderZeigen()
	if sektion == "start" or aktuell == nil then
		zeige(startSektion(), 1)
	elseif sektion then
		zeige(sektion, (ORDNUNG[sektion] or 1) >= (ORDNUNG[aktuell] or 1) and 1 or -1)
	elseif not erlaubt(aktuell) then
		zeige("Anforderungen", -1)
	end
	topSetzen()
	untenSetzen()
end

-- ===== Training öffnen und schließen (mit Animation) =====
local skala = Training:FindFirstChild("TSGSkala") or Instance.new("UIScale")
skala.Name = "TSGSkala"
skala.Parent = Training
local trainingPos = Training.Position
local buttonsPos = Buttons and Buttons.Position
local wechselt = false
local function schliessen()
	if wechselt then
		return
	end
	wechselt = true
	spiele(WECHSEL)
	tween(skala, 0.25, { Scale = 0.94 }, Enum.EasingStyle.Quint, Enum.EasingDirection.In)
	tween(Training, 0.25, { Position = trainingPos + UDim2.fromOffset(0, 30) }, Enum.EasingStyle.Quint, Enum.EasingDirection.In).Completed:Wait()
	Training.Visible = false
	Training.Position = trainingPos
	skala.Scale = 1
	if Buttons then
		Buttons.GroupTransparency = 1
		Buttons.Position = buttonsPos + UDim2.fromOffset(-40, 0)
		Buttons.Visible = true
		tween(Buttons, 0.4, { GroupTransparency = 0, Position = buttonsPos })
	end
	wechselt = false
end
local function oeffnen()
	if wechselt then
		return
	end
	wechselt = true
	spiele(WECHSEL)
	if Buttons and Buttons.Visible then
		tween(Buttons, 0.2, { GroupTransparency = 1, Position = buttonsPos + UDim2.fromOffset(-40, 0) }).Completed:Wait()
		Buttons.Visible = false
		Buttons.Position = buttonsPos
		Buttons.GroupTransparency = 0
	end
	skala.Scale = 0.94
	Training.Position = trainingPos + UDim2.fromOffset(0, 30)
	Training.Visible = true
	tween(skala, 0.35, { Scale = 1 })
	tween(Training, 0.35, { Position = trainingPos })
	wechselt = false
	laden(false, "start")
end

local function zurueckKlick()
	-- Kalender → zurück zum Assessment, sonst (Anforderungen, Theorie, Praktisch) das ganze Training schließen
	if aktuell == "Calender" then
		zeige("Assessment", -1)
	else
		schliessen()
	end
end

-- ===== Verbinden =====
for name, cg in pairs(SEKTOR) do
	knopf(cg:FindFirstChild("Btn"), function()
		zeige(name, (ORDNUNG[name] or 1) >= (ORDNUNG[aktuell] or 1) and 1 or -1)
	end, true)
end
knopf(zurueck, zurueckKlick)
knopf(tZurueck, zurueckKlick)
knopf(submitKnopf, absenden)
knopf(guides, nil) -- „Guides“: vorerst ohne Funktion
knopf(kalBtn, function()
	zeige("Calender", 1)
end)
knopf(nextBtn, function()
	if aktuell == "Anforderungen" then
		zeige(theorieBestanden() and "Assessment" or "Theorie", 1)
	elseif aktuell == "Assessment" then
		local tr = meinTraining()
		if tr then
			beitreten(tr.Id)
		end
	end
end)
if Buttons then
	for _, cg in ipairs(Buttons:GetChildren()) do
		local b = cg:FindFirstChildWhichIsA("GuiButton")
		if b then
			b.MouseEnter:Connect(function()
				spiele(HOVER)
			end)
			b.Activated:Connect(function()
				spiele(KLICK)
				if cg.Name == "training" then
					oeffnen()
				end
			end)
		end
	end
end
Training:GetPropertyChangedSignal("Visible"):Connect(function()
	if Training.Visible and not wechselt then
		task.spawn(laden, false, "start")
	end
end)

-- Countdown jede Sekunde, alle 20 Sekunden frische Daten vom Server
task.spawn(function()
	local takt = 0
	while true do
		task.wait(1)
		if Training.Visible and z then
			theorieText()
			assessmentText()
			statusTag()
			for _, r in pairs(calZeilen) do
				calZeit(r)
				joinZustand(r)
			end
			untenSetzen()
			takt += 1
			if takt >= 20 then
				takt = 0
				task.spawn(laden)
			end
		end
	end
end)

if Training.Visible then
	task.spawn(laden, false, "start")
end
