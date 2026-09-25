-- CihuyAkz Studio Lite
-- Example Script: starter code you can edit or replace.

local Players = game:GetService("Players")

local function onPlayerAdded(player)
    print(("Welcome, %s!"):format(player.Name))
end

Players.PlayerAdded:Connect(onPlayerAdded)
