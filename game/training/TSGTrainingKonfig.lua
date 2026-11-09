--[[
  Train Sim Germany – Trainings im Spiel: Einstellungen
  Liegt als ModuleScript in ServerStorage (die richtigen Antworten sieht so kein Spieler).
  Dazu gehören ServerScriptService.TSGTraining (Script) und StarterGui.Menu.container.Training.TSGTraining (LocalScript).

  Ablauf je Rang: 1. Anforderungen → 2. Theorie (Fragen zum NÄCHSTEN Rang) → 3. Praktisch (Training aus der App).

  Neue Anforderung oder Frage: einfach eine Zeile kopieren und anpassen.
  Anforderungen (Typ):
    "Gruppe"     – Mitglied der Roblox-Gruppe (Zeile antippen = der Gruppe beitreten)
    "XP"         – Menge = nötige XP (aus player.playerStats.Ehrfahrung, siehe K.XP)
    "Spielzeit"  – Stunden = nötige Spielzeit im Spiel (wird vom Server mitgezählt)
    "ImRang"     – Tage = so lange schon im aktuellen Rang
    "Attribut"   – Name = Attribut am Spieler, Wert = Zahl (mindestens) oder true/Text (genau)
    "Funktion"   – Pruefen = function(player, info) return fortschritt (0…1 oder true/false), "Anzeige" end
                   info = { XP = …, Spielzeit = Sekunden, Rang = "QD" }
  Fragen (Typ):
    "Auswahl"    – genau eine Antwort richtig: Richtig = Nummer der Option
    "Mehrfach"   – mehrere richtig: Richtig = { Nummern }
    "Text"       – Eingabe: Antworten = { erlaubte Schreibweisen } (Groß/Klein, Leer- und Satzzeichen, Umlaute egal)
  Punkte = Gewicht der Frage (Standard 1). Optionen werden für jeden Spieler gemischt.
]]

local K = {}

-- ===== Hauptschalter =====
-- true  = Echtzeit: echter Rang aus der Gruppe, echte XP, echte Spielzeit, Trainings aus der App, 4 Tage Sperre,
--         Teleport in den Trainingsserver, alles wird gespeichert.
-- false = Simulation: ALLES wird simuliert und nichts gespeichert. Man startet als Gast, XP, Spielzeit und Gruppe
--         springen nach 10 Sekunden auf den nötigen Wert, die Sperre dauert 10 Sekunden, Trainings sind Beispiele,
--         „Join“ simuliert das Training und befördert nach 10 Sekunden in den nächsten Rang.
K.Echtzeit = true

K.GruppenId = 33684346
K.Backend = "https://tsg-backend.lorismziray01.workers.dev" -- wie in assets/js/config.js → api
K.Bestehensgrenze = 0.9 -- Anteil der Punkte zum Bestehen (0.9 = mindestens 90 % richtig, höchstens 10 % falsch)
K.MaxFragen = 10 -- höchstens so viele Fragen pro Versuch (bei mehr Fragen im Pool zufällig ausgewählt)
K.Sperre = 4 * 24 * 3600 -- Sperrfrist nach nicht bestandener Theorie in Sekunden (exakt ab Absenden)
K.JoinVorher = 15 * 60 -- der Trainingsserver öffnet so viele Sekunden vor Beginn
K.XP = { Ordner = "playerStats", Wert = "Ehrfahrung" }

-- Ränge wie in der Roblox-Gruppe („[QD] Qualified Driver“). Team = Name des Teams in Studio: dessen TeamColor wird
-- genommen (ändert sich die Teamfarbe in Studio, ändert sie sich auch hier). Farbe = Ersatz ohne passendes Team.
K.Raenge = {
	G = { Name = "Guest", Farbe = "#AFB4BB" },
	LD = { Name = "Learning Driver", Farbe = "#F0646B" },
	QD = { Name = "Qualified Driver", Team = "Driver", Farbe = "#D3212D" },
	PS = { Name = "Platform Staff", Team = "Platform Staff", Farbe = "#E2A512" },
	CD = { Name = "Conductor", Team = "Conductor", Farbe = "#E8702A" },
	SG = { Name = "Signaller", Team = "Signaller", Farbe = "#2FA65A" },
	["J-SV"] = { Name = "Junior Supervisor", Team = "Supervisor", Farbe = "#55C3DD" },
	SV = { Name = "Supervisor", Team = "Supervisor", Farbe = "#1FA9C9" },
	DM = { Name = "Driver Manager", Team = "Manager", Farbe = "#9C72DB" },
	PSM = { Name = "Platform Staff Manager", Team = "Manager", Farbe = "#9C72DB" },
	CDM = { Name = "Conductor Manager", Team = "Manager", Farbe = "#9C72DB" },
	SGM = { Name = "Signaller Manager", Team = "Manager", Farbe = "#9C72DB" },
	PRD = { Name = "Public Relations Department", Farbe = "#2346D8" },
	PJE = { Name = "Project Engineer", Team = "Project Engineer", Farbe = "#E479AE" },
	OM = { Name = "Operation Manager", Team = "Manager", Farbe = "#8A5CD0" },
	CDR = { Name = "Community Director", Team = "Director", Farbe = "#3CB98C" },
	CEN = { Name = "Chief Engineer", Team = "Chief Engineer", Farbe = "#D12FC8" },
}

-- ===== Stufen: von welchem Rang zu welchem Rang =====
K.Stufen = {
	-- Rang 1: Gäste und Learning Driver → Qualified Driver
	{
		Von = { "G", "LD" },
		Ziel = "QD",
		Anforderungen = {
			{ Typ = "Gruppe", Text = "Join the Train Sim Germany Group" },
			{ Typ = "Spielzeit", Stunden = 1, Text = "Play for at least 1 hour" }, -- freie Anforderung A
			{ Typ = "XP", Menge = 50, Text = "Earn at least 50 XP" }, -- freie Anforderung B
		},
		Fragen = {
			{ Typ = "Auswahl", Punkte = 2, Text = "Which signal authorizes a train driver to enter the next section of track?",
				Optionen = { "The Main Signal (Hp)", "The Distant Signal (Vr)", "The Shunting Signal (Sh)" }, Richtig = 1 },
			{ Typ = "Mehrfach", Punkte = 2, Text = "Which of the following must a driver have with them in the cab?",
				Optionen = { "A functional, accurate watch", "The current timetable (Buchfahrplan or EBuLa)", "The official operational rulebooks (e.g. Ril 408)", "A personal toolbox for mechanical engine repairs" }, Richtig = { 1, 2, 3 } },
			{ Typ = "Text", Punkte = 1, Text = "What is the test called that checks the brakes before departure?",
				Antworten = { "Brake test", "Brakes test", "Breaks test", "Brake check", "Bremsprobe" } },
			{ Typ = "Auswahl", Punkte = 2, Text = "What does the signal aspect Hp 0 mean?",
				Optionen = { "Stop! You must bring the train to a halt before the signal.", "Proceed at 40 km/h.", "Proceed at line speed." }, Richtig = 1 },
			{ Typ = "Mehrfach", Punkte = 1, Text = "What do you check during the walk-around before departure?",
				Optionen = { "Condition of the pantograph carbon strips", "Proper fit and alignment of the brake discs", "Uninterrupted integrity of the front windshield", "The exact internal temperature of the transformer oil" }, Richtig = { 1, 2, 3 } },
			{ Typ = "Text", Punkte = 1, Text = "Which PZB frequency (in Hz) is active at a distant signal showing \"expect stop\"?",
				Antworten = { "1000", "1000 Hz", "1.000 Hz" } },
			{ Typ = "Text", Punkte = 1, Text = "What is the name of the safety device that brakes the train if the driver stops responding?",
				Antworten = { "SiFa", "Sicherheitsfahrschaltung", "Dead man's switch", "Deadman switch", "Dead man switch" } },
			{ Typ = "Mehrfach", Punkte = 2, Text = "Which steps belong to leaving the cab at the end of a journey?",
				Optionen = { "Secure the train against rolling away using the holding brake.", "Set the direction selector to neutral (0).", "Release the doors on the platform side so passengers can leave.", "Shift the direction selector into \"Reverse\"." }, Richtig = { 1, 2, 3 } },
			{ Typ = "Mehrfach", Punkte = 2, Text = "Which conditions must be met before departure?",
				Optionen = { "The departure signal displays a proceed aspect (e.g. Hp 1 or Hp 2).", "The door closing sequence is finished and all doors are closed.", "The scheduled departure time has been reached or dispatch has been given.", "The train radio must be switched off entirely." }, Richtig = { 1, 2, 3 } },
			{ Typ = "Mehrfach", Punkte = 3, Text = "Which statements about PZB are correct?",
				Optionen = { "The 500 Hz magnet monitors the speed shortly before the main signal.", "Passing an active 2000 Hz magnet instantly triggers an emergency brake.", "PZB is designed to prevent a train from passing a signal at danger.", "The PZB system relies entirely on real-time GPS tracking." }, Richtig = { 1, 2, 3 } },
		},
	},

	-- Rang 2: Qualified Driver → Platform Staff (die Gruppe entfällt)
	{
		Von = { "QD" },
		Ziel = "PS",
		Anforderungen = {
			{ Typ = "XP", Menge = 300, Text = "Earn at least 300 XP" },
			{ Typ = "Spielzeit", Stunden = 6, Text = "Play for at least 6 hours" },
		},
		Fragen = {
			{ Typ = "Auswahl", Punkte = 2, Text = "What is the main task of Platform Staff during a departure?",
				Optionen = { "Keeping the platform safe and giving the departure order", "Driving the train out of the station", "Setting routes in the signal box" }, Richtig = 1 },
			{ Typ = "Auswahl", Punkte = 1, Text = "What does the white line along the platform edge mean?",
				Optionen = { "Passengers must stay behind it while trains enter or pass", "It marks the end of the platform", "It shows where first class stops" }, Richtig = 1 },
			{ Typ = "Text", Punkte = 2, Text = "What is the departure signal Zp 9 called? (one word)",
				Antworten = { "Abfahren", "Depart", "Departure", "Abfahrauftrag" } },
			{ Typ = "Mehrfach", Punkte = 2, Text = "When may you give the departure order?",
				Optionen = { "All doors are closed", "The departure signal shows a proceed aspect", "Nobody is standing in the danger zone", "Passengers are still boarding" }, Richtig = { 1, 2, 3 } },
			{ Typ = "Auswahl", Punkte = 1, Text = "What do you announce before the doors close?",
				Optionen = { "\"Please stand clear!\" (Zurückbleiben bitte)", "\"Next stop: Berlin Hbf\"", "Nothing – announcements are only for the conductor" }, Richtig = 1 },
			{ Typ = "Auswahl", Punkte = 2, Text = "A passenger is caught in a door after you gave the departure order. What do you do?",
				Optionen = { "Immediately signal the driver to stop", "Nothing – the door will open again by itself", "Wait until the train has left" }, Richtig = 1 },
			{ Typ = "Mehrfach", Punkte = 1, Text = "Which tools does Platform Staff use for dispatching?",
				Optionen = { "Signal disc (Kelle)", "Whistle", "Handheld or train radio", "Track wrench" }, Richtig = { 1, 2, 3 } },
			{ Typ = "Text", Punkte = 1, Text = "Which colour does the signal disc (Kelle) show for departure? (one word)",
				Antworten = { "Green", "Grün" } },
			{ Typ = "Auswahl", Punkte = 1, Text = "Where should Platform Staff stand while dispatching?",
				Optionen = { "Where the driver can see them and they can see the whole train", "Inside the train", "On the track behind the train" }, Richtig = 1 },
			{ Typ = "Auswahl", Punkte = 3, Text = "A train arrives while people crowd the platform edge. What is your first action?",
				Optionen = { "Ask everyone to step back behind the white line and keep the edge clear", "Give the departure order quickly so the train leaves", "Leave the platform" }, Richtig = 1 },
		},
	},

	-- Rang 3: Platform Staff → Conductor
	{
		Von = { "PS" },
		Ziel = "CD",
		Anforderungen = {
			{ Typ = "XP", Menge = 600, Text = "Earn at least 600 XP" },
		},
		Fragen = {
			{ Typ = "Auswahl", Punkte = 2, Text = "What is the conductor's main responsibility?",
				Optionen = { "Passenger safety, tickets and a safe departure", "Driving the train", "Setting the signals" }, Richtig = 1 },
			{ Typ = "Mehrfach", Punkte = 2, Text = "Which tasks belong to the conductor?",
				Optionen = { "Checking tickets", "Making announcements", "Closing the doors before departure", "Repairing the pantograph" }, Richtig = { 1, 2, 3 } },
			{ Typ = "Auswahl", Punkte = 1, Text = "When do you check that all doors are closed?",
				Optionen = { "Before reporting the train ready to depart", "After the train has left the station", "Only at the final stop" }, Richtig = 1 },
			{ Typ = "Text", Punkte = 1, Text = "Which document must every passenger have to travel? (one word)",
				Antworten = { "Ticket", "Fahrkarte", "Fahrschein" } },
			{ Typ = "Auswahl", Punkte = 2, Text = "A passenger without a ticket refuses to pay. What do you do?",
				Optionen = { "Stay calm, explain the rules and call a supervisor if needed", "Push the passenger out of the train", "Ignore it" }, Richtig = 1 },
			{ Typ = "Auswahl", Punkte = 1, Text = "What belongs in an announcement before arrival?",
				Optionen = { "The next station, the exit side and connections", "The driver's name", "The top speed of the train" }, Richtig = 1 },
			{ Typ = "Mehrfach", Punkte = 2, Text = "When must the conductor stop a departure?",
				Optionen = { "A person is caught in a door", "A door cannot be locked", "There is an emergency on the platform", "The train is one minute late" }, Richtig = { 1, 2, 3 } },
			{ Typ = "Text", Punkte = 2, Text = "What is the signal Zp 10 called that tells everyone the doors are closing? (two words)",
				Antworten = { "Türen schließen", "Tueren schliessen", "Close doors", "Doors closing" } },
			{ Typ = "Auswahl", Punkte = 1, Text = "Where does the conductor usually stand during departure?",
				Optionen = { "At a door with a view along the train", "In the driver's cab", "On the tracks" }, Richtig = 1 },
			{ Typ = "Auswahl", Punkte = 3, Text = "A passenger feels unwell during the journey. What is the right first step?",
				Optionen = { "Help, ask others for help and have the driver call emergency services if needed", "Wait until the final stop", "Tell the passenger to get off at the next station" }, Richtig = 1 },
		},
	},

	-- Rang 4: Conductor → Signaller
	{
		Von = { "CD" },
		Ziel = "SG",
		Anforderungen = {
			{ Typ = "XP", Menge = 1000, Text = "Earn at least 1000 XP" },
			{ Typ = "Spielzeit", Stunden = 72, Text = "Play for at least 3 days (72 hours)" },
		},
		Fragen = {
			{ Typ = "Auswahl", Punkte = 2, Text = "What must be set and locked before a main signal can show a proceed aspect?",
				Optionen = { "A route (Fahrstraße)", "The train's doors", "The platform lights" }, Richtig = 1 },
			{ Typ = "Auswahl", Punkte = 2, Text = "What does the substitute signal Zs 1 allow?",
				Optionen = { "Passing a main signal at stop (or failed) without a written order", "Driving at 160 km/h", "Shunting only" }, Richtig = 1 },
			{ Typ = "Mehrfach", Punkte = 2, Text = "What must be ensured before you clear a signal for a train?",
				Optionen = { "The track section ahead is clear", "The points are set and locked in the right position", "Flank protection is in place", "The driver has phoned you" }, Richtig = { 1, 2, 3 } },
			{ Typ = "Text", Punkte = 1, Text = "What does Hp 1 mean? (one word)",
				Antworten = { "Fahrt", "Proceed", "Clear", "Go" } },
			{ Typ = "Auswahl", Punkte = 1, Text = "What does Hp 2 mean?",
				Optionen = { "Proceed at reduced speed (usually 40 km/h)", "Stop", "Shunting allowed" }, Richtig = 1 },
			{ Typ = "Auswahl", Punkte = 2, Text = "What is flank protection?",
				Optionen = { "Protection against other vehicles running into the route from the side", "A barrier at level crossings", "A brake test before departure" }, Richtig = 1 },
			{ Typ = "Mehrfach", Punkte = 2, Text = "Which messages belong to train reporting between signal boxes (Zugmeldeverfahren)?",
				Optionen = { "Offering a train (Anbieten)", "Accepting a train (Annehmen)", "Departure report (Abmelden)", "Changing the train's livery" }, Richtig = { 1, 2, 3 } },
			{ Typ = "Text", Punkte = 1, Text = "What is the German word for the route a train takes through points and signals? (one word)",
				Antworten = { "Fahrstraße", "Fahrstrasse" } },
			{ Typ = "Auswahl", Punkte = 1, Text = "A signal cannot be cleared because of a fault. How may a train still pass it?",
				Optionen = { "With a written order (Befehl) or the substitute signal Zs 1", "The driver simply ignores it", "It is not possible at all" }, Richtig = 1 },
			{ Typ = "Auswahl", Punkte = 3, Text = "Two trains want to use the same single-track section. What must the signaller ensure?",
				Optionen = { "Only one train is in the section at a time", "Both trains enter at low speed", "The faster train goes first and the other follows right behind" }, Richtig = 1 },
		},
	},
}

return K
