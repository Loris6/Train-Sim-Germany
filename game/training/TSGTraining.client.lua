--[[
  Train Sim Germany – Trainings im Menü (Client)
  Liegt als LocalScript in StarterGui.Menu.container.Training und füllt das vorhandene Design mit Logik.
  Am Design wird nichts hinzugefügt: Zustände werden aus den Vorlagen im Layout übernommen.
    Top (selector, quiz, practical) – reine Anzeige, nicht klickbar. Fertig sieht aus wie im Design der Abschnitt mit
                    grünem Hintergrund und Haken, offen wie die Abschnitte mit dunklem Hintergrund.
    Anforderungen   – Zeile ohne Balken mit Haken = erfüllt, Zeile mit rotem Balken = Fortschritt (Balken läuft an).
    Theory          – Q1 (Auswahl), Q10 (Mehrfachauswahl), Q3 (Texteingabe) sind die Vorlagen; das TextLabel oben
                    zeigt Hinweis bzw. Sperrzeit. Gewählte Antworten leuchten wie der grüne „Join“-Knopf.
    Assessment      – Text im Format des Designs, Tags (#Nummer, Rang, Spieler, Status), Leitung und Supervisors.
    calender        – obere Zeile = zugewiesenes Training, darunter die Trennlinie und alle weiteren.
    bottom          – Return (Kalender → Assessment, sonst Training schließen), Guides (noch ohne Funktion),
                    Kalender, „Join Assessment →“ nur grün und klickbar, wenn der Server offen ist.
  Daten kommen vom Server (ServerScriptService.TSGTraining), Einstellungen in ServerStorage.TSGTrainingKonfig.
]]

local GroupService = game:GetService("GroupService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local Training = script.Parent
local container = Training.Parent
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

local function tween(inst, zeit, ziel, stil, richtung)
	local tw = TweenService:Create(inst, TweenInfo.new(zeit, stil or Enum.EasingStyle.Quint, richtung or Enum.EasingDirection.Out), ziel)
	tw:Play()
	return tw
end
local function esc(s)
	return (tostring(s or ""):gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub("\"", "&quot;"))
end
local function thumb(userId)
	return userId and string.format("rbxthumb://type=AvatarHeadShot&id=%d&w=150&h=150", userId) or ""
end
local function fontFarbe(text, standard)
	return (tostring(text or ""):match("<font color=['\"](#%x+)['\"]")) or standard
end

-- ===== Klick-Ton: modern, leise, nur beim Klicken =====
local klick = Instance.new("Sound")
klick.Name = "TSGKlick"
klick.SoundId = "rbxassetid://15675059323" -- Roblox_UI_Bright_Click
klick.Volume = 0.35
klick.Parent = script
local gesperrt = {} -- Knöpfe, die gerade nicht klickbar sind
local function knopf(btn, beiKlick)
	if not btn or not btn:IsA("GuiButton") then
		return
	end
	btn.Activated:Connect(function()
		if gesperrt[btn] then
			return
		end
		klick.TimePosition = 0
		klick:Play()
		if beiKlick then
			task.spawn(beiKlick)
		end
	end)
end

-- ===== Meldungen (container.notify, Vorlage = notify.Frame) =====
local notifyVorlage = notify and notify:FindFirstChild("Frame")
local notifyBg = notifyVorlage and notifyVorlage.BackgroundTransparency or 0.1
if notifyVorlage then
	notifyVorlage.Visible = false
end
local function melden(text)
	if not notifyVorlage then
		warn("[TSG] " .. tostring(text))
		return
	end
	notify.Visible = true
	local f = notifyVorlage:Clone()
	f.Name = "Meldung"
	local label = f:FindFirstChildOfClass("TextLabel")
	local bild = f:FindFirstChildOfClass("ImageLabel")
	if label then
		label.Text = text
		label.TextTransparency = 1
	end
	if bild then
		bild.ImageTransparency = 1
	end
	f.BackgroundTransparency = 1
	f.Visible = true
	f.Parent = notify
	tween(f, 0.3, { BackgroundTransparency = notifyBg })
	if label then
		tween(label, 0.3, { TextTransparency = 0 })
	end
	if bild then
		tween(bild, 0.3, { ImageTransparency = 0 })
	end
	task.delay(4.5, function()
		tween(f, 0.35, { BackgroundTransparency = 1 })
		if label then
			tween(label, 0.35, { TextTransparency = 1 })
		end
		if bild then
			tween(bild, 0.35, { ImageTransparency = 1 })
		end
		task.wait(0.4)
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
	return os.date("!*t", t + (sommer and 7200 or 3600)), sommer and "MESZ" or "MEZ"
end
local function datum(t)
	local d = berlin(t or 0)
	return string.format("%02d.%02d.%04d — %02d:%02d", d.day, d.month, d.year, d.hour, d.min)
end
local function uhrzeit(t)
	local d, zone = berlin(t or 0)
	return string.format("%02d:%02d %s", d.hour, d.min, zone)
end
local function kurz(sek) -- Kalender: „(in 21 min)“
	if sek < 3600 then
		return math.max(1, math.ceil(sek / 60)) .. " min"
	elseif sek < 86400 then
		return math.floor(sek / 3600) .. " h"
	elseif sek < 7 * 86400 then
		return math.floor(sek / 86400) .. " d"
	end
	return math.floor(sek / (7 * 86400)) .. " w"
end
local function lang(sek) -- Assessment: „16 mins“
	local function n(x, eins, mehr)
		return x .. " " .. (x == 1 and eins or mehr)
	end
	if sek < 3600 then
		return n(math.max(1, math.ceil(sek / 60)), "min", "mins")
	elseif sek < 86400 then
		return n(math.floor(sek / 3600), "hour", "hours")
	elseif sek < 7 * 86400 then
		return n(math.floor(sek / 86400), "day", "days")
	end
	return n(math.floor(sek / (7 * 86400)), "week", "weeks")
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
-- „Conductor Training — From DS to CD“ wie im Design
local function rangText()
	if not z or not z.Ziel then
		return string.format("Your rank: <font color='%s'>%s</font>", z and z.Rang.Farbe or "#ffffff", esc(z and z.Rang.Name or ""))
	end
	return string.format("%s Training — From <font color='%s'>%s</font> to <font color='%s'>%s</font>",
		esc(z.Ziel.Name), z.Rang.Farbe, esc(z.Rang.Kuerzel), z.Ziel.Farbe, esc(z.Ziel.Kuerzel))
end

-- ===== Top: Anzeige der 3 Abschnitte (nicht klickbar) =====
local SEKTOR = { Anforderungen = Top:FindFirstChild("selector"), Theorie = Top:FindFirstChild("quiz"), Assessment = Top:FindFirstChild("practical") }
local function stilLesen(cg)
	local btn = cg:FindFirstChild("Btn")
	local sel = btn and btn:FindFirstChild("selected")
	local ic = sel and sel:FindFirstChild("icon")
	local h = btn and btn:FindFirstChild("heading")
	return {
		bg = cg.BackgroundColor3, bgT = cg.BackgroundTransparency,
		selBg = sel and sel.BackgroundColor3, selT = sel and sel.BackgroundTransparency,
		icon = ic and ic.Visible, bild = ic and ic.Image, text = h and h.TextColor3,
	}
end
local stilFertig, stilOffen
for _, cg in pairs(SEKTOR) do
	local s = stilLesen(cg)
	if s.icon then
		stilFertig = stilFertig or s
	else
		stilOffen = stilOffen or s
	end
end
stilFertig = stilFertig or stilOffen
stilOffen = stilOffen or stilFertig
local function topSetzen()
	for name, cg in pairs(SEKTOR) do
		local s = fertig(name) and stilFertig or stilOffen
		if s then
			tween(cg, 0.35, { BackgroundColor3 = s.bg, BackgroundTransparency = s.bgT })
			local btn = cg:FindFirstChild("Btn")
			local sel = btn and btn:FindFirstChild("selected")
			local ic = sel and sel:FindFirstChild("icon")
			local h = btn and btn:FindFirstChild("heading")
			if sel and s.selBg then
				tween(sel, 0.35, { BackgroundColor3 = s.selBg, BackgroundTransparency = s.selT })
			end
			if ic then
				if s.icon then
					ic.Image = s.bild
				end
				ic.Visible = s.icon
			end
			if h and s.text then
				tween(h, 0.35, { TextColor3 = s.text })
			end
		end
	end
end

-- ===== Unten =====
local unten = bottom:FindFirstChild("Frame")
local nextBtn = unten and unten:FindFirstChild("Next")
local nextText = nextBtn and nextBtn:FindFirstChildOfClass("TextLabel")
local guides = unten and unten:FindFirstChild("Guides")
local kalBtn = unten and kind(unten, "calender", "Calender")
local zurueck = bottom:FindFirstChild("return")
-- leuchtend = wie „Join Assessment →“ im Design, abgedunkelt = wie „← Return“
local LEUCHT_BG = nextBtn and nextBtn.BackgroundColor3 or Color3.fromHex("00ff5e")
local LEUCHT_T = nextBtn and nextBtn.BackgroundTransparency or 0.2
local DUNKEL_BG = zurueck and zurueck.BackgroundColor3 or Color3.fromHex("000014")
local DUNKEL_T = zurueck and zurueck.BackgroundTransparency or 0.1

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
local nextStand = nil
local function nextSetzen()
	if not nextBtn then
		return
	end
	local tr = meinTraining()
	local an = tr ~= nil and istOffen(tr) and darf(tr)
	if nextStand == an then
		return
	end
	nextStand = an
	gesperrt[nextBtn] = not an
	tween(nextBtn, 0.25, { BackgroundColor3 = an and LEUCHT_BG or DUNKEL_BG, BackgroundTransparency = an and LEUCHT_T or DUNKEL_T })
	if nextText then
		tween(nextText, 0.25, { TextTransparency = an and 0 or 0.5 })
	end
end
local function untenSetzen()
	if unten then
		unten.Visible = aktuell == "Assessment"
	end
	nextSetzen()
end

-- ===== 1. Anforderungen =====
local A = F.Anforderungen
local aKopf = A and A:FindFirstChild("Heading")
local aRang = aKopf and aKopf:FindFirstChild("Rank")
local aListe = A and kind(A, "conent", "content")
local function statusBild(row)
	local a1 = row:FindFirstChild("A1") or row:FindFirstChildWhichIsA("GuiButton")
	local box = a1 and a1:FindFirstChild("ImageLabel")
	if box and box:IsA("ImageLabel") then
		return box
	end
	return box and box:FindFirstChildOfClass("ImageLabel")
end
local reqVorlage, bildFertig, bildOffen
if aListe then
	local zeileFertig, zeileOffen
	for _, row in ipairs(aListe:GetChildren()) do
		if row:IsA("CanvasGroup") then
			if row:FindFirstChild("Frame") then
				zeileOffen = zeileOffen or row
			else
				zeileFertig = zeileFertig or row
			end
		end
	end
	local bf = zeileFertig and statusBild(zeileFertig)
	local bo = zeileOffen and statusBild(zeileOffen)
	bildFertig = bf and { Image = bf.Image, T = bf.ImageTransparency }
	bildOffen = bo and { Image = bo.Image, T = bo.ImageTransparency }
	reqVorlage = (zeileOffen or zeileFertig)
	reqVorlage = reqVorlage and reqVorlage:Clone()
	for _, row in ipairs(aListe:GetChildren()) do
		if row:IsA("CanvasGroup") then
			row:Destroy()
		end
	end
end
local reqZeilen = {}
local function gruppeBeitreten()
	if not z then
		return
	end
	if z.Simulation then
		laden(true, nil, "gruppe")
		return
	end
	pcall(GroupService.PromptJoinAsync, GroupService, z.GruppenId)
	task.wait(1)
	laden(true)
	task.wait(5)
	laden(true) -- Roblox meldet den Beitritt manchmal etwas später
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
	r = { row = row, text = text, bild = statusBild(row), balken = row:FindFirstChild("Frame"), fertig = nil }
	if r.balken then
		r.balken.Size = UDim2.new(0, 0, r.balken.Size.Y.Scale, r.balken.Size.Y.Offset)
	end
	knopf(text, function()
		if r.aktion == "gruppe" then
			gruppeBeitreten()
		end
	end)
	row.Parent = aListe
	reqZeilen[i] = r
	return r
end
local function balkenZiel(r, wert)
	local s = r.balken.Size
	return UDim2.new(math.clamp(wert, 0, 1), 0, s.Y.Scale, s.Y.Offset)
end
local function anforderungenZeigen(animieren)
	if not A or not z or not aListe or not reqVorlage then
		return
	end
	if aRang then
		aRang.Text = rangText()
	end
	local liste = (not z.KeinTraining and z.Anforderungen) or {}
	for i, a in ipairs(liste) do
		local r = reqZeile(i)
		r.row.Visible = true
		r.aktion = a.Aktion
		if r.text then
			r.text.Text = a.Anzeige and (a.Text .. "  ·  " .. a.Anzeige) or a.Text
		end
		local warFertig = r.fertig
		r.fertig = a.Fertig
		if a.Fertig then
			-- erfüllt: wie die Zeile ohne Balken im Design (Haken). Gerade erst erfüllt: Balken läuft voll, dann Haken.
			local function haken()
				if not r.fertig then
					return
				end
				if r.bild and bildFertig then
					r.bild.Image = bildFertig.Image
					r.bild.ImageTransparency = bildFertig.T
				end
				if r.balken then
					r.balken.Visible = false
				end
			end
			if warFertig == false and r.balken then
				r.balken.Visible = true
				tween(r.balken, 0.8, { Size = balkenZiel(r, 1) }).Completed:Once(haken)
			else
				haken()
			end
		else
			-- offen: roter Balken läuft von links nach rechts bis zum Fortschritt
			if r.bild and bildOffen then
				r.bild.Image = bildOffen.Image
				r.bild.ImageTransparency = bildOffen.T
			end
			if r.balken then
				r.balken.Visible = true
				if animieren then
					r.balken.Size = balkenZiel(r, 0)
				end
				tween(r.balken, animieren and 1 or 0.5, { Size = balkenZiel(r, tonumber(a.Wert) or 0) })
			end
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
end
local submitKnopf = tAbsenden and tAbsenden:FindFirstChildOfClass("TextButton")
local tZurueck = tAbsenden and tAbsenden:FindFirstChild("return")

local function wahlZeigen(e)
	for k, kb in pairs(e.knoepfe) do
		local an = e.wahl[k] == true
		tween(kb.b, 0.2, { BackgroundColor3 = an and LEUCHT_BG or kb.bg, BackgroundTransparency = an and LEUCHT_T or kb.bgT })
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
			f.LayoutOrder = 1 + i -- wie im Design: Q1 = 2 … Q10 = 11
			local kopf
			for _, c in ipairs(f:GetChildren()) do
				if c:IsA("Frame") and c:FindFirstChildOfClass("TextLabel") and not c:FindFirstChildWhichIsA("TextBox", true) then
					kopf = c
					break
				end
			end
			local label = kopf and kopf:FindFirstChildOfClass("TextLabel")
			if label then
				local extra = q.Typ == "Mehrfach" and " (Select one or more answers)" or ""
				label.Text = string.format("<font color='#ff0000'>Question %d</font> | %s%s", i, esc(q.Text), extra)
			end
			local eintrag = { typ = q.Typ, wahl = {}, knoepfe = {} }
			if q.Typ == "Text" then
				local box = f:FindFirstChildWhichIsA("TextBox", true)
				if box then
					box.Text = ""
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
						b.Parent = f
						eintrag.knoepfe[k] = { b = b, bg = b.BackgroundColor3, bgT = b.BackgroundTransparency }
						knopf(b, function()
							if q.Typ == "Auswahl" then
								eintrag.wahl = { [k] = true }
							else
								eintrag.wahl[k] = (not eintrag.wahl[k]) or nil
							end
							wahlZeigen(eintrag)
						end)
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

local function theorieText()
	if not tInfo or not z then
		return
	end
	local th = z.Theorie or {}
	if z.KeinTraining then
		tInfo.Text = "You have already completed all trainings."
	elseif th.Status == "offen" then
		tInfo.Text = string.format("Theory Quiz for <b>%s</b>: answer all %d questions. You need at least %d %% to pass.",
			esc(z.Ziel.Name), #(th.Fragen or {}), math.floor((z.Grenze or 0.9) * 100 + 0.5))
	elseif th.Status == "sperre" then
		tInfo.Text = string.format("You did not pass the theory%s.<br/>Next attempt in <font color='#ff0000'>%s</font> (on %s).",
			th.Prozent and (" (" .. th.Prozent .. " %)") or "", rest((th.Bis or 0) - jetzt()), datum(th.Bis or 0))
	elseif th.Status == "bestanden" then
		tInfo.Text = string.format("Theory passed%s. Continue with the practical training.", th.Prozent and (" with " .. th.Prozent .. " %") or "")
	else
		tInfo.Text = "Complete all requirements first."
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
	-- gesperrt, bestanden oder Sperrfrist: Fragen ausblenden, nur das TextLabel bleibt sichtbar
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
		melden(string.format("Please answer all questions (%d still open).", fehlt))
		return
	end
	sendet = true
	local ok, res = pcall(rAbsenden.InvokeServer, rAbsenden, z.Theorie.Id, antworten)
	sendet = false
	if not ok or type(res) ~= "table" then
		melden("Could not submit – please try again.")
		return
	end
	if res.Ok == false then
		melden(esc(res.Text or "Could not submit."))
		laden()
		return
	end
	if res.Bestanden then
		melden(string.format("Theory passed with %d %%! You are #%s in the queue.", res.Prozent, tostring(res.Nummer or "?")))
		laden(false, "Assessment")
	else
		melden(string.format("Not passed (%d %%). You need %d %%.", res.Prozent, math.floor((z.Grenze or 0.9) * 100 + 0.5)))
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
			local l = t:FindFirstChildOfClass("TextLabel")
			local tx = l and string.lower(l.Text) or ""
			if tx:match("^%s*#") then
				tag.Warteschlange = t
			elseif tx:find("player") then
				tag.Spieler = t
			elseif tx:find("closed") or tx:find("open") then
				tag.Status = t
			else
				tag.Rang = tag.Rang or t
			end
		end
	end
end
local statusZu = tag.Status and { bg = tag.Status.BackgroundColor3, t = tag.Status.BackgroundTransparency }
local rangT = tag.Rang and tag.Rang.BackgroundTransparency or 0.1
local function tagText(t, text)
	local l = t and t:FindFirstChildOfClass("TextLabel")
	if l and l.Text ~= text then
		l.Text = text
	end
end

local profilHost, helferVorlage
local helferFrames = {}
if hostBox then
	profilHost = hostBox:FindFirstChild("Profil1")
	for _, c in ipairs(hostBox:GetChildren()) do
		if c:IsA("Frame") and c ~= profilHost then
			table.insert(helferFrames, c)
		end
	end
	table.sort(helferFrames, function(a, b)
		return a.LayoutOrder < b.LayoutOrder
	end)
	helferVorlage = helferFrames[#helferFrames] and helferFrames[#helferFrames]:Clone()
end
local function profilBild(profil, userId)
	local img = profil:FindFirstChildOfClass("ImageLabel")
	if img then
		img.Image = thumb(userId)
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
		profilBild(profilHost, tr.HostId) -- Leitung (roter Rand im Design)
	end
	local helfer = tr.Helfer or {}
	for i, h in ipairs(helfer) do
		local f = helferFrames[i]
		if not f and helferVorlage then
			f = helferVorlage:Clone()
			f.Name = "Profil" .. (i + 1)
			f.LayoutOrder = i + 1
			f.Parent = hostBox
			helferFrames[i] = f
		end
		if f then
			f.Visible = true
			profilBild(f, h.Id) -- Supervisors (schwarzer Rand im Design)
		end
	end
	for i = #helfer + 1, #helferFrames do
		helferFrames[i].Visible = false
	end
end

local function statusTag()
	if not tag.Status then
		return
	end
	local offen = istOffen(meinTraining())
	tagText(tag.Status, offen and "Open" or "Closed")
	local bg = offen and LEUCHT_BG or statusZu.bg
	local bt = offen and LEUCHT_T or statusZu.t
	if tag.Status.BackgroundColor3 ~= bg or tag.Status.BackgroundTransparency ~= bt then
		tween(tag.Status, 0.3, { BackgroundColor3 = bg, BackgroundTransparency = bt })
	end
end
-- „Next Training Session:<br/>Starting in 16 mins at 10:00 MEZ with [CEN] EinfachLost.“ wie im Design
local function assessmentText()
	if not pText or not z then
		return
	end
	local tr = meinTraining()
	if z.KeinTraining and not leitung() then
		pText.Text = "Next Training Session:<br/>There is no practical training for your rank."
		return
	end
	if not theorieBestanden() and not leitung() then
		pText.Text = "Next Training Session:<br/>Pass the theory first."
		return
	end
	if not tr then
		pText.Text = string.format("Next Training Session:<br/>No training assigned yet – you are <b>#%s</b> in the queue and will be assigned automatically.", tostring(z.Praktisch and z.Praktisch.Nummer or "?"))
		return
	end
	local mit = string.format("<b>[%s] %s</b>", esc(tr.HostKuerzel or "?"), esc(tr.HostName ~= "" and tr.HostName or "?"))
	local s = tr.Start - jetzt()
	if s > 0 then
		pText.Text = string.format("Next Training Session:<br/>Starting in <font color='#ff0000'>%s</font> at <font color='#ff0000'>%s</font> with %s.", lang(s), uhrzeit(tr.Start), mit)
	else
		pText.Text = string.format("Next Training Session:<br/>Running since <font color='#ff0000'>%s</font> with %s.", uhrzeit(tr.Start), mit)
	end
end
local function assessmentZeigen()
	if not P or not z then
		return
	end
	local tr = meinTraining()
	if pRang then
		pRang.Text = rangText()
	end
	local zielName = (z.Ziel and z.Ziel.Name) or (tr and tr.Ziel) or "Training"
	local zielFarbe = (z.Ziel and z.Ziel.Farbe) or (tr and tr.ZielFarbe)
	if tag.Rang then
		tagText(tag.Rang, zielName)
		if zielFarbe then
			tween(tag.Rang, 0.3, { BackgroundColor3 = Color3.fromHex(zielFarbe), BackgroundTransparency = rangT })
		end
	end
	tagText(tag.Spieler, tr and string.format("%d/%d Players", tr.Belegt, tr.Plaetze) or "– Players")
	local nr = z.Praktisch and z.Praktisch.Nummer
	if tag.Warteschlange then
		tag.Warteschlange.Visible = nr ~= nil
		tagText(tag.Warteschlange, nr and ("#" .. nr) or "")
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
local function zeitLabel(row)
	local btn = row:FindFirstChild("Btn")
	if not btn then
		return nil
	end
	for _, c in ipairs(btn:GetChildren()) do
		if c:IsA("TextLabel") and c.Position.X.Scale >= 0.5 then
			return c
		end
	end
	return nil
end
local vorlageZugewiesen, vorlageNormal, trenner
local farbeZugewiesen, farbeNormal = "#ffff7f", "#00ff5e"
if cListe then
	local zeilen = {}
	for _, c in ipairs(cListe:GetChildren()) do
		if c:IsA("CanvasGroup") then
			table.insert(zeilen, c)
		elseif c:IsA("Frame") then
			trenner = trenner or c
		end
	end
	table.sort(zeilen, function(a, b)
		return a.LayoutOrder < b.LayoutOrder
	end)
	-- obere Zeile im Design = zugewiesenes Training, untere = weitere Trainings
	vorlageZugewiesen = zeilen[1]
	vorlageNormal = zeilen[#zeilen]
	local zl = vorlageZugewiesen and zeitLabel(vorlageZugewiesen)
	local nl = vorlageNormal and zeitLabel(vorlageNormal)
	farbeZugewiesen = fontFarbe(zl and zl.Text, farbeZugewiesen)
	farbeNormal = fontFarbe(nl and nl.Text, farbeNormal)
	vorlageZugewiesen = vorlageZugewiesen and vorlageZugewiesen:Clone()
	vorlageNormal = vorlageNormal and vorlageNormal:Clone()
	for _, c in ipairs(zeilen) do
		c:Destroy()
	end
	if trenner then
		trenner.Visible = false
	end
end
local calZeilen = {}
local function joinZustand(r)
	if not r.join then
		return
	end
	local an = r.tr ~= nil and darf(r.tr) and istOffen(r.tr)
	if r.an == an then
		return
	end
	r.an = an
	gesperrt[r.join] = not an
	tween(r.join, 0.25, { BackgroundColor3 = an and r.joinBg or DUNKEL_BG, BackgroundTransparency = an and r.joinT or DUNKEL_T })
	local img = r.join:FindFirstChildOfClass("ImageLabel")
	if img then
		tween(img, 0.25, { ImageTransparency = an and 0 or 0.5 })
	end
end
local function calZeit(r)
	local tr = r.tr
	if not tr or not r.zeit then
		return
	end
	local s = tr.Start - jetzt()
	local wann = s > 0 and ("in " .. kurz(s)) or "running"
	local text = string.format("%s%s <font color='%s'>(%s)</font>", tr.Meins and (leitung() and "hosting " or "zugewiesen ") or "", datum(tr.Start), tr.Meins and farbeZugewiesen or farbeNormal, wann)
	if r.zeit.Text ~= text then
		r.zeit.Text = text
	end
end
local function calZeile(tr)
	local schluessel = tr.Id .. (tr.Meins and "#m" or "")
	local r = calZeilen[schluessel]
	if r then
		return r
	end
	local vorlage = (tr.Meins and vorlageZugewiesen or vorlageNormal) or vorlageNormal or vorlageZugewiesen
	local row = vorlage:Clone()
	row.Name = "Training"
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
		if r.join then
			r.joinBg, r.joinT = r.join.BackgroundColor3, r.join.BackgroundTransparency
			knopf(r.join, function()
				if r.tr then
					beitreten(r.tr.Id)
				end
			end)
		end
		knopf(btn, function()
			local t = r.tr
			if t then
				melden(string.format("%s · %d/%d Players%s", esc(t.Titel ~= "" and t.Titel or "Training"), t.Belegt, t.Plaetze, t.Server ~= "" and (" · " .. esc(t.Server)) or ""))
			end
		end)
	end
	row.Parent = cListe
	calZeilen[schluessel] = r
	return r
end
local function kalenderZeigen()
	if not C or not z or not cListe then
		return
	end
	local zielName = (z.Ziel and z.Ziel.Name) or "Your"
	if cTitel then
		cTitel.Text = string.format("Upcoming Trainings <font color='%s'>%s Trainings</font>", (z.Ziel and z.Ziel.Farbe) or farbeZugewiesen, esc(zielName))
	end
	local liste = (z.Praktisch and z.Praktisch.Trainings) or {}
	local gesehen, hatMeins, hatAndere = {}, false, false
	if vorlageNormal or vorlageZugewiesen then
		local n = 0
		for _, tr in ipairs(liste) do
			local r = calZeile(tr)
			r.tr = tr
			gesehen[r] = true
			if tr.Meins then
				hatMeins = true
				r.row.LayoutOrder = 0 -- das zugewiesene Training steht ganz oben
			else
				hatAndere = true
				n += 1
				r.row.LayoutOrder = (trenner and trenner.LayoutOrder or 2) + n
			end
			if r.avatar then
				r.avatar.Image = thumb(tr.HostId)
			end
			if r.kuerzel then
				r.kuerzel.Text = tr.HostKuerzel or "?"
				r.kuerzel.BackgroundColor3 = Color3.fromHex(tr.HostFarbe or "#878C96")
			end
			if r.name then
				r.name.Text = tr.HostName ~= "" and tr.HostName or "?"
			end
			calZeit(r)
			joinZustand(r)
		end
	end
	for key, r in pairs(calZeilen) do
		if not gesehen[r] then
			r.row:Destroy()
			calZeilen[key] = nil
		end
	end
	if trenner then
		trenner.Visible = hatMeins and hatAndere
	end
end

-- ===== Join =====
local neuLaden
beitreten = function(id)
	if not id then
		return
	end
	local ok, res = pcall(rBeitreten.InvokeServer, rBeitreten, id)
	if not ok or type(res) ~= "table" then
		melden("Join failed – please try again.")
		return
	end
	melden(esc(res.Text or ""))
	if res.Aktualisieren then
		neuLaden(res.Aktualisieren)
	end
end

-- ===== Abschnitte wechseln (weich hereingleiten) =====
zeige = function(name, richtung)
	local f = F[name]
	if not f or not erlaubt(name) then
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
		tween(f, 0.4, { Position = startPos[f] })
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
local timerNr = 0
neuLaden = function(zeitpunkt)
	timerNr += 1
	local meine = timerNr
	task.delay(math.max(0.5, zeitpunkt - jetzt() + 0.5), function()
		if meine == timerNr and Training.Visible then
			laden()
		end
	end)
end
laden = function(frisch, sektion, aktion)
	if laedt then
		return
	end
	laedt = true
	local vorher = z
	local ok, res = pcall(rZustand.InvokeServer, rZustand, frisch == true, aktion)
	laedt = false
	if not ok or type(res) ~= "table" or res.Fehler then
		melden("Training data could not be loaded – please try again.")
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
	elseif not erlaubt(aktuell) or (vorher and vorher.Rang and z.Rang.Kuerzel ~= vorher.Rang.Kuerzel) then
		zeige(startSektion(), -1)
	elseif aktuell == "Anforderungen" and z.AnforderungenFertig and not (vorher and vorher.AnforderungenFertig) then
		-- alle Anforderungen gerade erfüllt: kurz zeigen, dann weiter zur Theorie
		task.delay(1.6, function()
			if aktuell == "Anforderungen" and erlaubt("Theorie") then
				zeige(theorieBestanden() and "Assessment" or "Theorie", 1)
			end
		end)
	end
	topSetzen()
	untenSetzen()
	if z.Aktualisieren then
		neuLaden(z.Aktualisieren)
	end
end

-- ===== Training öffnen und schließen =====
local trainingPos = Training.Position
local buttonsPos = Buttons and Buttons.Position
local wechselt = false
local function schliessen()
	if wechselt then
		return
	end
	wechselt = true
	tween(Training, 0.3, { Position = trainingPos + UDim2.fromOffset(0, 40) }, Enum.EasingStyle.Quint, Enum.EasingDirection.In).Completed:Wait()
	Training.Visible = false
	Training.Position = trainingPos
	if Buttons then
		Buttons.GroupTransparency = 1
		Buttons.Position = buttonsPos + UDim2.fromOffset(-40, 0)
		Buttons.Visible = true
		tween(Buttons, 0.45, { GroupTransparency = 0, Position = buttonsPos })
	end
	wechselt = false
end
local function oeffnen()
	if wechselt then
		return
	end
	wechselt = true
	if Buttons and Buttons.Visible then
		tween(Buttons, 0.25, { GroupTransparency = 1, Position = buttonsPos + UDim2.fromOffset(-40, 0) }).Completed:Wait()
		Buttons.Visible = false
		Buttons.Position = buttonsPos
		Buttons.GroupTransparency = 0
	end
	Training.Position = trainingPos + UDim2.fromOffset(0, 40)
	Training.Visible = true
	tween(Training, 0.45, { Position = trainingPos })
	wechselt = false
	laden(false, "start")
end
local function zurueckKlick()
	-- Kalender → zurück zum Assessment, sonst (Anforderungen, Theorie, Praktisch) das Training schließen
	if aktuell == "Calender" then
		zeige("Assessment", -1)
	else
		schliessen()
	end
end

-- ===== Verbinden (die Abschnitte oben sind nur Anzeige und bekommen nichts) =====
knopf(zurueck, zurueckKlick)
knopf(tZurueck, zurueckKlick)
knopf(submitKnopf, absenden)
knopf(guides, nil) -- „Guides“: vorerst ohne Funktion
knopf(kalBtn, function()
	zeige("Calender", 1)
end)
knopf(nextBtn, function()
	local tr = meinTraining()
	if tr then
		beitreten(tr.Id)
	end
end)
if Buttons then
	for _, cg in ipairs(Buttons:GetChildren()) do
		local b = cg:FindFirstChildWhichIsA("GuiButton")
		if b then
			knopf(b, cg.Name == "training" and oeffnen or nil)
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
			if z.Theorie and z.Theorie.Status == "sperre" then
				theorieText()
			end
			assessmentText()
			statusTag()
			for _, r in pairs(calZeilen) do
				calZeit(r)
				joinZustand(r)
			end
			nextSetzen()
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
