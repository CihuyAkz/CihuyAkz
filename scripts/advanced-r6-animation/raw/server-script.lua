local Players = game:GetService("Players")
local RepStorage = game:GetService("ReplicatedStorage")
 
local AnimationsFolder = RepStorage:FindFirstChild("Animations")
if not AnimationsFolder then
    AnimationsFolder = Instance.new("Folder")
    AnimationsFolder.Name = "Animations"
    AnimationsFolder.Parent = RepStorage
end
 
for _, child in ipairs(script:GetChildren()) do
    if child:IsA("KeyframeSequence") then
        if not AnimationsFolder:FindFirstChild(child.Name) then
            child.Parent = AnimationsFolder
        end
    end
end
 
local WALK_SPEED = 16
local RUN_SPEED = 24
local PlayerRunToggle = {}
local PlayerAnimState = {}
 
local ToggleRunState = RepStorage:FindFirstChild("ToggleRunState")
if not ToggleRunState then
    ToggleRunState = Instance.new("RemoteEvent")
    ToggleRunState.Name = "ToggleRunState"
    ToggleRunState.Parent = RepStorage
end
 
local ReplicateAnimation = RepStorage:FindFirstChild("ReplicateAnimation")
if not ReplicateAnimation then
    ReplicateAnimation = Instance.new("RemoteEvent")
    ReplicateAnimation.Name = "ReplicateAnimation"
    ReplicateAnimation.Parent = RepStorage
end
 
local RequestAnimState = RepStorage:FindFirstChild("RequestAnimState")
if not RequestAnimState then
    RequestAnimState = Instance.new("RemoteEvent")
    RequestAnimState.Name = "RequestAnimState"
    RequestAnimState.Parent = RepStorage
end
 
ToggleRunState.OnServerEvent:Connect(function(player, isRunning)
    PlayerRunToggle[player] = isRunning
    local char = player.Character
    if char then
        local hum = char:FindFirstChild("Humanoid")
        if hum then
            hum.WalkSpeed = isRunning and RUN_SPEED or WALK_SPEED
        end
    end
    for _, otherPlayer in ipairs(Players:GetPlayers()) do
        ToggleRunState:FireClient(otherPlayer, player, isRunning)
    end
end)
 
ReplicateAnimation.OnServerEvent:Connect(function(player, animationName)
    PlayerAnimState[player] = animationName
    for _, otherPlayer in ipairs(Players:GetPlayers()) do
        ReplicateAnimation:FireClient(otherPlayer, player, animationName)
    end
end)
 
RequestAnimState.OnServerEvent:Connect(function(requester, targetPlayer)
    local state = PlayerAnimState[targetPlayer]
    if state then
        RequestAnimState:FireClient(requester, targetPlayer, state)
    end
end)
 
Players.PlayerAdded:Connect(function(player)
    player.CharacterAdded:Connect(function(char)
        local hum = char:WaitForChild("Humanoid")
        hum.WalkSpeed = WALK_SPEED
        PlayerRunToggle[player] = false
        PlayerAnimState[player] = "Idle"
        task.wait(1)
        for _, otherPlayer in ipairs(Players:GetPlayers()) do
            ReplicateAnimation:FireClient(otherPlayer, player, "Idle")
        end
    end)
end)
 
Players.PlayerRemoving:Connect(function(player)
    PlayerRunToggle[player] = nil
    PlayerAnimState[player] = nil
end)