--[[
  Train Sim Germany – Nachrichten aus der App im Spiel-Chat (nur auf privaten Servern mit Server-Chat)

  Einrichten: als LocalScript nach StarterPlayer → StarterPlayerScripts legen.
  Der Server (TSGAppSync.server.lua) schickt Begrüßung, Regeln und – wenn in der App eingeschaltet –
  die Nachrichten aus dem Server-Chat. Alle Texte sind vorher von Roblox gefiltert.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextChatService = game:GetService("TextChatService")

local appMessage = ReplicatedStorage:WaitForChild("TSGAppMessage")

local function escape(text)
	return (tostring(text):gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"))
end

local function show(line)
	local channels = TextChatService:FindFirstChild("TextChannels")
	local general = channels and (channels:FindFirstChild("RBXGeneral") or channels:FindFirstChild("RBXSystem"))
	if general then
		general:DisplaySystemMessage(line)
	end
end

appMessage.OnClientEvent:Connect(function(m)
	if type(m) ~= "table" or not m.text then
		return
	end
	if m.kind == "welcome" then
		show('<font color="#FFC400"><b>Willkommen:</b></font> ' .. escape(m.text))
	elseif m.kind == "rules" then
		show('<font color="#FFC400"><b>Regeln:</b></font> ' .. escape(m.text))
	else
		show('<font color="#EC0016"><b>[App] ' .. escape(m.name or "?") .. ':</b></font> ' .. escape(m.text))
	end
end)
