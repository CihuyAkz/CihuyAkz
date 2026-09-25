local RunSvc = game:GetService("RunService")
local RepStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
 
local Player = Players.LocalPlayer
local Char = script.Parent
local Hum = Char:WaitForChild("Humanoid")
local HRP = Char:WaitForChild("HumanoidRootPart")
 
if not Char:IsDescendantOf(workspace) then
    Char.AncestryChanged:Wait()
end
task.wait(0.5)
 
local PlayerGui = Player:WaitForChild("PlayerGui", 30)
if not PlayerGui then return end
 
local RunGui = Instance.new("ScreenGui")
RunGui.Name = "RunGui"
RunGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
RunGui.Parent = PlayerGui
 
local RunButton = Instance.new("ImageButton")
RunButton.Name = "RunButton"
RunButton.BorderSizePixel = 0
RunButton.ScaleType = Enum.ScaleType.Fit
RunButton.BackgroundTransparency = 1
RunButton.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
RunButton.ZIndex = 2
RunButton.Image = "rbxassetid://16861351260"
RunButton.Size = UDim2.new(0.10334, 0, 0.24561, 0)
RunButton.Position = UDim2.new(0.73319, 0, 0.52047, 0)
RunButton.Parent = RunGui
 
local UIAspectRatioConstraint = Instance.new("UIAspectRatioConstraint")
UIAspectRatioConstraint.Parent = RunButton
 
local AnimationsFolder = nil
local ToggleRunState = nil
local ReplicateAnimation = nil
local maxRetries = 30
local retryDelay = 0.5
 
for i = 1, maxRetries do
    AnimationsFolder = RepStorage:FindFirstChild("Animations")
    ToggleRunState = RepStorage:FindFirstChild("ToggleRunState")
    ReplicateAnimation = RepStorage:FindFirstChild("ReplicateAnimation")
    if AnimationsFolder and ToggleRunState then break end
    if i == maxRetries then return end
    task.wait(retryDelay)
end
 
if not ReplicateAnimation then
    ReplicateAnimation = Instance.new("RemoteEvent")
    ReplicateAnimation.Name = "ReplicateAnimation"
    ReplicateAnimation.Parent = RepStorage
end
 
local AnimSequences = {
    Idle  = AnimationsFolder:FindFirstChild("IdleAnim"),
    Walk  = AnimationsFolder:FindFirstChild("WalkAnim"),
    Run   = AnimationsFolder:FindFirstChild("RunAnim"),
    Jump  = AnimationsFolder:FindFirstChild("JumpAnim"),
    Land  = AnimationsFolder:FindFirstChild("LandAnim"),
    Sit   = AnimationsFolder:FindFirstChild("SitAnim"),
}
 
local maxStamina = 10
local stamina = maxStamina
local staminaRegenRate = maxStamina / 13
local lastSprintTime = 0
local FADE_DELAY = 1
 
local billboardGui = Instance.new("BillboardGui")
billboardGui.Name = "StaminaBarFloating"
billboardGui.Size = UDim2.new(1, 0, 4, 0)
billboardGui.StudsOffset = Vector3.new(2.5, 0, 0)
billboardGui.AlwaysOnTop = true
billboardGui.Parent = HRP
 
local bgFrame = Instance.new("Frame")
bgFrame.Size = UDim2.new(0.25, 0, 1, 0)
bgFrame.Position = UDim2.new(0.375, 0, 0, 0)
bgFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 15)
bgFrame.BorderSizePixel = 0
bgFrame.BackgroundTransparency = 0.4
bgFrame.Parent = billboardGui
 
local bgCorner = Instance.new("UICorner")
bgCorner.CornerRadius = UDim.new(0, 3)
bgCorner.Parent = bgFrame
 
local staminaBarFloat = Instance.new("Frame")
staminaBarFloat.Size = UDim2.new(0.6, 0, 0.95, 0)
staminaBarFloat.BorderSizePixel = 0
staminaBarFloat.AnchorPoint = Vector2.new(0, 1)
staminaBarFloat.Position = UDim2.new(0.2, 0, 0.975, 0)
staminaBarFloat.Parent = bgFrame
 
local barCorner = Instance.new("UICorner")
barCorner.CornerRadius = UDim.new(0, 3)
barCorner.Parent = staminaBarFloat
billboardGui.Enabled = false
 
local function updateStaminaColor()
    if not staminaBarFloat or not staminaBarFloat.Parent then return end
    local percentage = stamina / maxStamina
    local color
    if percentage > 0.5 then
        color = Color3.fromRGB(100, 200, 255)
    elseif percentage > 0.25 then
        color = Color3.fromRGB(255, 220, 50)
    else
        color = Color3.fromRGB(255, 50, 50)
    end
    staminaBarFloat.BackgroundColor3 = color
end
 
local function fadeIn()
    if not billboardGui or not billboardGui.Parent then return end
    billboardGui.Enabled = true
    local tweenInfo = TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
    TweenService:Create(bgFrame, tweenInfo, {BackgroundTransparency = 0.4}):Play()
end
 
local function fadeOut()
    if not billboardGui or not billboardGui.Parent then return end
    local tweenInfo = TweenInfo.new(0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
    local tween = TweenService:Create(bgFrame, tweenInfo, {BackgroundTransparency = 1})
    tween:Play()
    tween.Completed:Connect(function()
        if billboardGui and billboardGui.Parent then
            billboardGui.Enabled = false
        end
    end)
end
 
local IsRunToggled = false
local CurrentState = "Idle"
local IsJumping = false
local IsLanding = false
local SPRINT_KEY = Enum.KeyCode.R
local keyPressed = false
 
local R6Player = {}
R6Player.__index = R6Player
 
function R6Player.new(char, sequence, loop)
    local self = setmetatable({}, R6Player)
    self.Char = char
    self.Seq = sequence
    self.Loop = loop
    self.Motors = {}
    self.Frames = {}
    self.Playing = false
    self.Index = 1
    self.Alpha = 0
    self.TargetAlpha = 0
    return self
end
 
function R6Player:GetMotor(pose)
    for _, m in ipairs(self.Char:GetDescendants()) do
        if m:IsA("Motor6D") and m.Part0 and m.Part1 then
            if m.Part1.Name == pose.Name and m.Part0.Name == pose.Parent.Name then
                return m
            end
        end
    end
end
 
function R6Player:Load()
    local keyframes = self.Seq:GetKeyframes()
    table.sort(keyframes, function(a,b) return a.Time < b.Time end)
    for i, kf in ipairs(keyframes) do
        local frame = {}
        for _, pose in ipairs(kf:GetDescendants()) do
            if pose:IsA("Pose") then
                local key = pose.Name .. ":" .. pose.Parent.Name
                if not self.Motors[key] then
                    self.Motors[key] = self:GetMotor(pose)
                end
                if self.Motors[key] then
                    frame[key] = pose.CFrame
                end
            end
        end
        self.Frames[i] = frame
    end
end
    
function R6Player:Play()
    self.Playing = true
    self.TargetAlpha = 1
    self.Index = 1
end
    
function R6Player:Stop()
    self.Playing = false
    self.TargetAlpha = 0
end
    
function R6Player:Update(dt)
    if self.Alpha < self.TargetAlpha then
        self.Alpha = math.min(1, self.Alpha + dt * 10)
    elseif self.Alpha > self.TargetAlpha then
        self.Alpha = math.max(0, self.Alpha - dt * 10)
    end
    if not self.Playing and self.Alpha < 0.01 then return end
    local frame = self.Frames[self.Index]
    if not frame then return end
    if self.Alpha > 0.01 then
        for key, cf in pairs(frame) do
            local motor = self.Motors[key]
            if motor and motor.Parent then
                motor.Transform = motor.Transform:Lerp(cf, self.Alpha * 0.3)
            end
        end
    end
    if self.Playing then
        self.Index = self.Index + 1
        if self.Index > #self.Frames then
            if self.Loop then
                self.Index = 1
            else
                self.Playing = false
            end
        end
    end
end
    
local function resetTPose(char)
    for _, motor in ipairs(char:GetDescendants()) do
        if motor:IsA("Motor6D") then
            motor.Transform = CFrame.new()
        end
    end
end
    
local h = Char:FindFirstChild("Humanoid")
if h then
    local animator = h:FindFirstChildOfClass("Animator")
    if animator then animator:Destroy() end
end
    
local animate = Char:FindFirstChild("Animate")
if animate then animate:Destroy() end
    
local Anims = {}
for name, seq in pairs(AnimSequences) do
    if seq then
        local loop = (name ~= "Jump" and name ~= "Land")
        Anims[name] = R6Player.new(Char, seq, loop)
        Anims[name]:Load()
    end
end
    
local OtherPlayersAnims = {}
    
local function setupOtherPlayerAnims(otherChar)
    if otherChar == Char then return end
    local otherPlayer = Players:GetPlayerFromCharacter(otherChar)
    if not otherPlayer then return end
    local otherHum = otherChar:FindFirstChild("Humanoid")
    if otherHum then
        local otherAnimator = otherHum:FindFirstChildOfClass("Animator")
        if otherAnimator then otherAnimator:Destroy() end
    end
    local otherAnimate = otherChar:FindFirstChild("Animate")
    if otherAnimate then otherAnimate:Destroy() end
    OtherPlayersAnims[otherPlayer.UserId] = {}
    for name, seq in pairs(AnimSequences) do
        if seq then
            local loop = (name ~= "Jump" and name ~= "Land")
            OtherPlayersAnims[otherPlayer.UserId][name] = R6Player.new(otherChar, seq, loop)
            OtherPlayersAnims[otherPlayer.UserId][name]:Load()
        end
    end
end
    
for _, otherPlayer in ipairs(Players:GetPlayers()) do
    if otherPlayer ~= Player and otherPlayer.Character then
        setupOtherPlayerAnims(otherPlayer.Character)
    end
end
    
Players.PlayerAdded:Connect(function(otherPlayer)
    if otherPlayer == Player then return end
    otherPlayer.CharacterAdded:Connect(function(otherChar)
        task.wait(1)
        setupOtherPlayerAnims(otherChar)
    end)
end)
    
for _, otherPlayer in ipairs(Players:GetPlayers()) do
    if otherPlayer ~= Player then
        otherPlayer.CharacterAdded:Connect(function(otherChar)
            task.wait(1)
            setupOtherPlayerAnims(otherChar)
        end)
    end
end
    
Players.PlayerRemoving:Connect(function(otherPlayer)
    OtherPlayersAnims[otherPlayer.UserId] = nil
end)
    
ReplicateAnimation.OnClientEvent:Connect(function(otherPlayer, animationState)
    local userId = otherPlayer.UserId
    if not OtherPlayersAnims[userId] then return end
    for name, anim in pairs(OtherPlayersAnims[userId]) do
        anim:Stop()
        anim.Alpha = 0
        anim.TargetAlpha = 0
    end
    if animationState == "Idle" then
        local otherChar = otherPlayer.Character
        if otherChar then resetTPose(otherChar) end
    end
    task.wait(0.05)
    if OtherPlayersAnims[userId][animationState] then
        OtherPlayersAnims[userId][animationState]:Play()
    end
end)
    
local function setState(newState)
    if CurrentState == newState then return end
    if IsJumping and newState ~= "Jump" then return end
    if IsLanding and newState ~= "Land" and newState ~= "Walk" and newState ~= "Run" and newState ~= "Jump" then return end
        
    for name, anim in pairs(Anims) do
        if name ~= newState then
            anim:Stop()
            anim.Alpha = 0
            anim.TargetAlpha = 0
        end
    end
        
    if Anims[newState] then
        if newState == "Jump" then IsJumping = true end
        if newState == "Land" then IsLanding = true end
        Anims[newState]:Play()
        CurrentState = newState
        ReplicateAnimation:FireServer(newState)
    else
        resetTPose(Char)
        CurrentState = newState
        ReplicateAnimation:FireServer(newState)
    end
end
    
local function toggleRun()
    IsRunToggled = not IsRunToggled
    RunButton.Image = IsRunToggled and "rbxassetid://16861357005" or "rbxassetid://16861351260"
    ToggleRunState:FireServer(IsRunToggled)
    if not IsRunToggled then
        lastSprintTime = tick()
    end
end
    
RunButton.MouseButton1Click:Connect(function()
    toggleRun()
end)
    
UserInputService.InputBegan:Connect(function(input, gameProcessed)
    if gameProcessed then return end
    if input.KeyCode == SPRINT_KEY and not keyPressed then
        keyPressed = true
        toggleRun()
    end
end)
    
UserInputService.InputEnded:Connect(function(input)
    if input.KeyCode == SPRINT_KEY then
        keyPressed = false
    end
end)
    
Hum.StateChanged:Connect(function(old, new)
    if new == Enum.HumanoidStateType.Jumping or new == Enum.HumanoidStateType.Freefall then
        if IsLanding then
            IsLanding = false
            if Anims["Land"] then Anims["Land"]:Stop() end
        end
    end
        
    if new == Enum.HumanoidStateType.Landed or
        new == Enum.HumanoidStateType.Running or
        new == Enum.HumanoidStateType.RunningNoPhysics then
        if IsJumping then
            IsJumping = false
            if Anims["Jump"] then
                Anims["Jump"]:Stop()
            end
            local isMoving = Hum.MoveDirection.Magnitude > 0.05
            if isMoving then
                IsLanding = false
                setState(IsRunToggled and "Run" or "Walk")
            else
                setState("Land")
                task.spawn(function()
                    if Anims["Land"] then
                        repeat task.wait() until not Anims["Land"].Playing or Hum.MoveDirection.Magnitude > 0.05
                    end
                    IsLanding = false
                    if Anims["Land"] and not Anims["Land"].Playing then
                        setState("Idle")
                    else
                        if Anims["Land"] then Anims["Land"]:Stop() end
                        setState(IsRunToggled and "Run" or "Walk")
                    end
                end)
            end
        end
    end
end)
    
local torso = Char:WaitForChild("Torso", 10)
if not torso then return end
    
local neck = torso:WaitForChild("Neck", 10)
local rootJoint = HRP:WaitForChild("RootJoint", 10)
local leftHip = torso:WaitForChild("Left Hip", 10)
local rightHip = torso:WaitForChild("Right Hip", 10)
    
if not neck or not rootJoint or not leftHip or not rightHip then return end
    
local neckC0 = neck.C0
local rootJointC0 = rootJoint.C0
local leftHipC0 = leftHip.C0
local rightHipC0 = rightHip.C0
    
local headTrackingRemote = RepStorage:FindFirstChild("HeadTrackingRemote")
if not headTrackingRemote then
    headTrackingRemote = Instance.new("RemoteEvent")
    headTrackingRemote.Name = "HeadTrackingRemote"
    headTrackingRemote.Parent = RepStorage
end
    
local AnimationSettings = {
    LerpSpeedHead = 24,
    LerpSpeedTorso = 8,
    LerpSpeedLegs = 0.005,
    
    HeadTurnRange = math.rad(80),
    TorsoTurnRange = math.rad(45),
    XzRotationRatio = math.rad(80) / 140,
    
    CameraBasedEffects = true,
    CombinedXZ = true,
    Multiplier1 = 0.3,
    Multiplier2 = 1,
    
    LeanZAmount = 0.2,
    LeanXAmount = 0.1,
    LeanBackMulti = 1.6,
    LeanForwardMulti = 0.5,
    
    Difference = 0.5,
    
    InversableCameraBasedEffects = true,
    InversableCameraThreshold = 0.3,
    InversableCameraSmoothing = 0.1,
}
    
local function getMovementData()
    local vel = HRP.AssemblyLinearVelocity
    local worldMoveDir = Vector3.new(vel.X, 0, vel.Z)
        
    local moveSpeedCap = 16
    if worldMoveDir.Magnitude > moveSpeedCap then
        worldMoveDir = worldMoveDir.Unit * moveSpeedCap
    end
        
    local moveDir = HRP.CFrame:VectorToObjectSpace(worldMoveDir)
    local normalizedMoveDir = moveDir / moveSpeedCap
        
    local veryNormalizedMoveDir = Vector3.zero
    if moveDir.Magnitude > 0.01 and not Hum.PlatformStand and not Hum.Sit then
        veryNormalizedMoveDir = moveDir.Unit
    end
        
    return normalizedMoveDir, veryNormalizedMoveDir
end
    
local lastSendTime = 0
local sendInterval = 0.05
    
local lastState = ""
RunSvc.Heartbeat:Connect(function(dt)
    for _, anim in pairs(Anims) do
        anim:Update(dt)
    end
    if next(OtherPlayersAnims) then
        for userId, anims in pairs(OtherPlayersAnims) do
            for _, anim in pairs(anims) do
                anim:Update(dt)
            end
        end
    end
        
    local isMoving = Hum.MoveDirection.Magnitude > 0.05
    if IsRunToggled and isMoving and stamina > 0 then
        stamina = math.max(0, stamina - dt)
        lastSprintTime = tick()
        if stamina <= 0 then
            IsRunToggled = false
            RunButton.Image = "rbxassetid://16861351260"
            ToggleRunState:FireServer(false)
        end
        if not billboardGui.Enabled then fadeIn() end
    else
        stamina = math.min(maxStamina, stamina + staminaRegenRate * dt)
    end
    if staminaBarFloat and staminaBarFloat.Parent then
        local percentage = stamina / maxStamina
        staminaBarFloat.Size = UDim2.new(0.6, 0, 0.95 * percentage, 0)
        updateStaminaColor()
    end
    if not IsRunToggled or not isMoving then
        local shouldHide = stamina >= maxStamina and tick() - lastSprintTime > FADE_DELAY
        if billboardGui and billboardGui.Enabled and stamina < maxStamina then
            shouldHide = false
        end
        if shouldHide and billboardGui and billboardGui.Enabled then
            fadeOut()
        end
    end
        
    if not IsJumping and not IsLanding then
        local state = Hum:GetState()
        local newState = ""
        if Hum.Sit then
            newState = "Sit"
        elseif state == Enum.HumanoidStateType.Jumping or state == Enum.HumanoidStateType.Freefall then
            newState = "Jump"
        elseif isMoving then
            newState = IsRunToggled and "Run" or "Walk"
        else
            newState = "Idle"
        end
        if newState ~= lastState then
            setState(newState)
            lastState = newState
        end
    elseif IsLanding and isMoving then
        IsLanding = false
        if Anims["Land"] then Anims["Land"]:Stop() end
        local newState = IsRunToggled and "Run" or "Walk"
        setState(newState)
        lastState = newState
    end
end)
    
local dmConnection
dmConnection = RunSvc.RenderStepped:Connect(function(dt)
    if not Char or not Char.Parent then
        dmConnection:Disconnect()
        return
    end
    if Hum.Health <= 0 then return end
        
    local camera = workspace.CurrentCamera
    if not camera then return end
        
    local camCFrame = camera.CFrame
    local rootCFrame = HRP.CFrame
        
    local normalizedMoveDir, veryNormalizedMoveDir = getMovementData()
        
    local tr = AnimationSettings.HeadTurnRange
    local tor = AnimationSettings.TorsoTurnRange
    local xzR = AnimationSettings.XzRotationRatio
    local lerpSpeedHead = AnimationSettings.LerpSpeedHead
    local lerpSpeedTorso = AnimationSettings.LerpSpeedTorso
    local lerpSpeedLegs = AnimationSettings.LerpSpeedLegs
    local multiplier1 = AnimationSettings.Multiplier1
    local multiplier2 = AnimationSettings.Multiplier2
    local leanZAmount = AnimationSettings.LeanZAmount
    local leanXAmount = AnimationSettings.LeanXAmount
    local difference = AnimationSettings.Difference
        
    local goalNeck = CFrame.new()
    local goalWaist = rootJointC0
        
    if AnimationSettings.CameraBasedEffects then
        local cameraDirection = rootCFrame:ToObjectSpace(camCFrame).LookVector
        local cameraY = cameraDirection.Y
        local cameraX
            
        if AnimationSettings.CombinedXZ then
            cameraX = Vector3.new(cameraDirection.X, 0, cameraDirection.Z).Unit.X
        else
            cameraX = cameraDirection.X
        end
            
        local mp, mp1 = multiplier1, multiplier2
            
        if AnimationSettings.InversableCameraBasedEffects then
            local avg = (-cameraDirection.Z) / 2
            local value = -1 + 2 * math.clamp(
                (avg + AnimationSettings.InversableCameraThreshold) / AnimationSettings.InversableCameraSmoothing,
                0, 1
            )
            mp = mp * value
            mp1 = mp1 * value
        end
            
        goalWaist = CFrame.Angles(math.asin(cameraY) * mp, -math.asin(cameraX) * mp, 0) * rootJointC0
        goalNeck = CFrame.Angles(math.asin(cameraY) * mp * 2, -math.asin(cameraX) * mp1, 0)
    end
        
    local walkingBackwards = veryNormalizedMoveDir.Z > difference
    local xRes = veryNormalizedMoveDir.X * (tr - math.abs(veryNormalizedMoveDir.Z) * (tr / 2))
    local xResXZ = veryNormalizedMoveDir.X * (xzR - math.abs(veryNormalizedMoveDir.Z) * (xzR / 2))
    local xLean = veryNormalizedMoveDir.X * tor
    local yxLean = normalizedMoveDir.X * tor
    local zLean = normalizedMoveDir.Z * tor
        
    if Hum.WalkSpeed > 16 then
        local baseWalkSpeed = 16
        local curveSoftness = 16
        local maxMultiplierIncrease = 1.5
        local excessSpeed = Hum.WalkSpeed - baseWalkSpeed
        local scaled = excessSpeed / (curveSoftness + excessSpeed)
        local zLeanMultiplier = 1 + maxMultiplierIncrease * scaled
        local xLeanMultiplier = 1 + (maxMultiplierIncrease * scaled) / 1.5
        zLean = zLean * zLeanMultiplier
        yxLean = yxLean * xLeanMultiplier
        xLean = xLean * xLeanMultiplier
    end
        
    if walkingBackwards then
        xRes = -xRes
        xLean = -xLean
        xResXZ = -xResXZ
        yxLean = -yxLean
    end
        
    local alphaHead = 1 - math.exp(-lerpSpeedHead * dt)
    local alphaTorso = 1 - math.exp(-lerpSpeedTorso * dt)
    local alphaLegs = 1 - lerpSpeedLegs ^ dt
        
    local targetWaistC0 = goalWaist * CFrame.Angles(-zLean * leanZAmount, -yxLean * leanXAmount, -xLean)
    local waistLerp = rootJoint.C0:Lerp(targetWaistC0, alphaTorso)
    rootJoint.C0 = waistLerp
        
    local zLeanCompensation = CFrame.Angles(zLean * leanZAmount, yxLean * leanXAmount, 0)
    local waistRotation = waistLerp * rootJointC0:Inverse()
    local rx, ry, rz = waistRotation:ToEulerAnglesXYZ()
        
    if AnimationSettings.CameraBasedEffects then
        local torsoYawOnly = CFrame.Angles(0, ry, 0)
        local inverseYaw = torsoYawOnly:Inverse()
        local targetNeckC0 = goalNeck * inverseYaw * neckC0 * zLeanCompensation
        local lerpedNeck = neck.C0:Lerp(targetNeckC0, alphaHead)
        local nrx, nry, nrz = lerpedNeck:ToEulerAnglesXYZ()
        neck.C0 = CFrame.new(neckC0.Position) * CFrame.Angles(nrx, nry, nrz)
    else
        local torsoYawOnly = CFrame.Angles(0, ry, 0)
        local inverseYaw = torsoYawOnly:Inverse()
        local targetNeckC0 = inverseYaw * neckC0 * zLeanCompensation
        neck.C0 = neck.C0:Lerp(targetNeckC0, alphaHead)
    end
        
    local currentLegCounterCFrame = targetWaistC0 * rootJointC0:Inverse()
    local legsCounterCFrame = currentLegCounterCFrame:Inverse()
        
    local targetRightHipC0 = legsCounterCFrame * rightHipC0
        * CFrame.new(-xResXZ * 70, 0, math.abs(xResXZ) * -30)
        * CFrame.Angles(0, -xRes, 0)
        
    local targetLeftHipC0 = legsCounterCFrame * leftHipC0
        * CFrame.new(-xResXZ * 70, 0, math.abs(xResXZ) * -30)
        * CFrame.Angles(0, -xRes, 0)
        
    rightHip.C0 = rightHip.C0:Lerp(targetRightHipC0, alphaLegs)
    leftHip.C0 = leftHip.C0:Lerp(targetLeftHipC0, alphaLegs)
        
    local now = tick()
    if now - lastSendTime >= sendInterval then
        lastSendTime = now
        headTrackingRemote:FireServer({
            neckC0 = neck.C0,
            rootJointC0 = rootJoint.C0,
            leftHipC0 = leftHip.C0,
            rightHipC0 = rightHip.C0
        })
    end
end)
    
Hum.Died:Connect(function()
    if dmConnection then dmConnection:Disconnect() end
    neck.C0 = neckC0
    rootJoint.C0 = rootJointC0
    leftHip.C0 = leftHipC0
    rightHip.C0 = rightHipC0
end)
    
resetTPose(Char)
CurrentState = ""
if Anims["Idle"] then
    Anims["Idle"].Alpha = 1
    Anims["Idle"].TargetAlpha = 1
    Anims["Idle"].Playing = true
    Anims["Idle"].Index = 1
    CurrentState = "Idle"
    ReplicateAnimation:FireServer("Idle")
end
    
Player.CharacterRemoving:Connect(function()
    if billboardGui then billboardGui:Destroy() end
end)
    
Player.CharacterAdded:Connect(function(newChar)
    Char = newChar
    Hum = Char:WaitForChild("Humanoid")
    HRP = Char:WaitForChild("HumanoidRootPart")
    IsRunToggled = false
    keyPressed = false
    stamina = maxStamina
    if billboardGui then
        billboardGui.Parent = HRP
        billboardGui.Enabled = false
    end
end)