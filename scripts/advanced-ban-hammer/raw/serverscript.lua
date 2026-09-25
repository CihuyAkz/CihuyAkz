local tool = script.Parent
local remoteEvent = tool:FindFirstChild("BanEvent") or Instance.new("RemoteEvent")
remoteEvent.Name = "BanEvent"
remoteEvent.Parent = tool

local function CreateSound(ID, PARENT, VOLUME, PITCH)
    local NEWSOUND = Instance.new("Sound")
    NEWSOUND.Parent = PARENT
    NEWSOUND.Volume = VOLUME
    NEWSOUND.Pitch = PITCH
    NEWSOUND.SoundId = "http://www.roblox.com/asset/?id="..ID
    NEWSOUND:Play()
    game:GetService("Debris"):AddItem(NEWSOUND, 10)
    return NEWSOUND
end

local function CreateWave(SIZE, WAIT, CFRAME, DOESROT, ROT, COLOR, GROW)
    local wave = Instance.new("Part")
    wave.Material = Enum.Material.Neon
    wave.Transparency = 0.5
    wave.CanCollide = false
    wave.Locked = true
    wave.Anchored = true
    wave.BrickColor = BrickColor.new(COLOR)
    wave.Name = "Effect"
    wave.Size = Vector3.new(0,0,0)
    wave.CFrame = CFRAME
    wave.Parent = workspace

    local mesh = Instance.new("SpecialMesh", wave)
    mesh.MeshType = Enum.MeshType.FileMesh
    mesh.MeshId = "http://www.roblox.com/asset/?id=20329976"
    mesh.Scale = SIZE
    mesh.Offset = Vector3.new(0, 0, -SIZE.X / 8)
    
    task.spawn(function()
        for i = 1, WAIT do
            task.wait(0.015)
            if not wave or not wave.Parent then break end
            mesh.Scale = mesh.Scale + GROW
            mesh.Offset = Vector3.new(0, 0, -(mesh.Scale.X / 8))
            if DOESROT == true then
                wave.CFrame = wave.CFrame * CFrame.fromEulerAnglesXYZ(0, ROT, 0)
            end
            wave.Transparency = wave.Transparency + (0.5 / WAIT)
            if wave.Transparency > 0.99 then
                wave:Destroy()
                break
            end
        end
    end)
end

local function createBanEffect(character)
    local banFolder = Instance.new("Folder")
    banFolder.Name = "BanEffect"
    banFolder.Parent = workspace

    local gui = Instance.new("BillboardGui")
    gui.AlwaysOnTop = true
    gui.Size = UDim2.new(5, 35, 2, 35)
    gui.StudsOffset = Vector3.new(0, 1, 0)
    
    local label = Instance.new("TextLabel")
    label.BackgroundTransparency = 1
    label.TextScaled = true
    label.BorderSizePixel = 0
    label.Text = "BANNED"
    label.Font = Enum.Font.Code
    label.TextSize = 30
    label.TextColor3 = Color3.new(1, 0, 0)
    label.Size = UDim2.new(1, 0, 0.5, 0)
    label.Parent = gui

    for _, v in ipairs(character:GetChildren()) do
        if v:IsA("BasePart") and v.Name ~= "HumanoidRootPart" then
            local clone = v:Clone()
            clone.CanCollide = false
            clone.Anchored = true
            clone.CFrame = v.CFrame
            clone.Parent = banFolder
            clone.Material = Enum.Material.Neon
            clone.Color = Color3.new(1, 0, 0)
            
            local decal = clone:FindFirstChildOfClass("Decal")
            if decal then decal:Destroy() end
            
            if clone.Name == "Head" then
                gui.Adornee = clone
                gui.Parent = banFolder
            end
        end
    end
    
    character:Destroy()
    
    task.spawn(function()
        for i = 1, 50 do
            task.wait(0.05)
            for _, v in ipairs(banFolder:GetChildren()) do
                if v:IsA("BasePart") then
                    if v.Transparency == 0 then
                        v.Transparency = 1
                    else
                        v.Transparency = 0
                    end
                end
            end
            gui.Enabled = not gui.Enabled
        end
        
        for _, v in ipairs(banFolder:GetChildren()) do
            if v:IsA("BasePart") then
                v.Transparency = 0
            end
        end
        gui.Enabled = true
        
        for i = 1, 20 do
            task.wait(0.05)
            for _, v in ipairs(banFolder:GetChildren()) do
                if v:IsA("BasePart") then
                    v.Transparency = v.Transparency + 0.05
                end
            end
            label.TextTransparency = label.TextTransparency + 0.05
        end
        banFolder:Destroy()
    end)
end

local ROOTC0 = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180))
local NECKC0 = CFrame.new(0, 1, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180))

remoteEvent.OnServerEvent:Connect(function(player, action, arg1, arg2, arg3)
    if action == "Equip" then
        local Character = player.Character
        if Character then
            local animScript = Character:FindFirstChild("Animate")
            if animScript then animScript.Disabled = true end
            local hum = Character:FindFirstChildOfClass("Humanoid")
            if hum then
                for _, track in ipairs(hum:GetPlayingAnimationTracks()) do track:Stop() end
            end

            local existing = Character:FindFirstChild("Adds")
            if existing then existing:Destroy() end

            local RightArm = Character:FindFirstChild("Right Arm") or Character:FindFirstChild("RightHand")
            if RightArm then
                local Weapon = Instance.new("Model")
                Weapon.Name = "Adds"
                Weapon.Parent = Character
                
                local HandlePart = Instance.new("Part")
                HandlePart.Material = Enum.Material.SmoothPlastic
                HandlePart.Transparency = 0
                HandlePart.CanCollide = false
                HandlePart.Locked = true
                HandlePart.Anchored = false
                HandlePart.BrickColor = BrickColor.new("Really black")
                HandlePart.Name = "Handle"
                HandlePart.Size = Vector3.new(0, 0, 0)
                HandlePart.Parent = Weapon
                
                local HandleMesh = Instance.new("SpecialMesh")
                HandleMesh.MeshType = Enum.MeshType.FileMesh
                HandleMesh.MeshId = "http://www.roblox.com/asset/?id=10604848"
                HandleMesh.TextureId = "http://www.roblox.com/asset/?id=10605252"
                HandleMesh.Scale = Vector3.new(1, 1, 1)
                HandleMesh.Offset = Vector3.new(0, 2.7, 0)
                HandleMesh.Parent = HandlePart
                
                local HandleWeld = Instance.new("Weld")
                HandleWeld.Name = "HandleWeld"
                HandleWeld.Part0 = RightArm
                HandleWeld.Part1 = HandlePart
                HandleWeld.C0 = CFrame.new(0, -0.8, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(0))
                HandleWeld.C1 = CFrame.new(0, 0, 0)
                HandleWeld.Parent = HandlePart
            end
        end

    elseif action == "Unequip" then
        if player.Character then
            local Weapon = player.Character:FindFirstChild("Adds")
            if Weapon then Weapon:Destroy() end
            
            local animScript = player.Character:FindFirstChild("Animate")
            if animScript then animScript.Disabled = false end

            local torso = player.Character:FindFirstChild("Torso") or player.Character:FindFirstChild("UpperTorso")
            local root = player.Character:FindFirstChild("HumanoidRootPart")
            if torso and root then
                local rj = torso:FindFirstChild("RootJoint") or root:FindFirstChild("RootJoint")
                local n = torso:FindFirstChild("Neck")
                local rs = torso:FindFirstChild("Right Shoulder")
                local ls = torso:FindFirstChild("Left Shoulder")
                local rh = torso:FindFirstChild("Right Hip")
                local lh = torso:FindFirstChild("Left Hip")

                if rj then rj.C0, rj.C1 = ROOTC0, CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180)) end
                if n then n.C0, n.C1 = NECKC0, CFrame.new(0, -0.5, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180)) end
                if rs then rs.C0, rs.C1 = CFrame.new(1, 0.5, 0)*CFrame.Angles(0,math.rad(90),0), CFrame.new(-0.5, 0.5, 0)*CFrame.Angles(0,math.rad(90),0) end
                if ls then ls.C0, ls.C1 = CFrame.new(-1, 0.5, 0)*CFrame.Angles(0,math.rad(-90),0), CFrame.new(0.5, 0.5, 0)*CFrame.Angles(0,math.rad(-90),0) end
                if rh then rh.C0, rh.C1 = CFrame.new(1, -1, 0)*CFrame.Angles(0,math.rad(90),0), CFrame.new(0.5, 1, 0)*CFrame.Angles(0,math.rad(90),0) end
                if lh then lh.C0, lh.C1 = CFrame.new(-1, -1, 0)*CFrame.Angles(0,math.rad(-90),0), CFrame.new(-0.5, 1, 0)*CFrame.Angles(0,math.rad(-90),0) end
            end
        end

    elseif action == "TeleportSound" then
        if player.Character then
            local Torso = player.Character:FindFirstChild("Torso") or player.Character:FindFirstChild("UpperTorso")
            if Torso then
                CreateSound("769380905", Torso, 10, 1)
            end
        end

    elseif action == "Slam" then
        local pos, radius, cframe = arg1, arg2, arg3
        CreateSound("147722910", workspace, 10, 1)
        CreateSound("289842971", workspace, 10, 1)
        
        CreateWave(Vector3.new(25, 0, 25), 45, cframe, true, 2, "Really red", Vector3.new(0, 3, 0))
        CreateWave(Vector3.new(25, 0, 25), 45, cframe, true, -2, "Really red", Vector3.new(0, 3, 0))

        for _, v in ipairs(game:GetService("Players"):GetPlayers()) do
            if v ~= player and v.Character and v.Character:FindFirstChild("HumanoidRootPart") then
                if (v.Character.HumanoidRootPart.Position - pos).Magnitude <= radius then
                    local targetChar = v.Character
                    local targetUserId = v.UserId
                    createBanEffect(targetChar)
                    task.defer(function()
                        local success = pcall(function()
                            game:GetService("Players"):BanAsync({
                                UserIds = {targetUserId},
                                Duration = -1,
                                DisplayReason = "You have been permanently banned by the Ban Hammer.",
                                PrivateReason = "Banned by Ban Hammer"
                            })
                        end)
                        if not success then
                            v:Kick("You have been permanently banned by the Ban Hammer.")
                        end
                    end)
                end
            end
        end
    end
end)