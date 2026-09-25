local Tool = script.Parent
Tool.RequiresHandle = false
local Player = game:GetService("Players").LocalPlayer
local Mouse = Player:GetMouse()
local Character, Humanoid, RootPart, Torso, Head
local RightArm, LeftArm, RightLeg, LeftLeg
local RootJoint, Neck, RightShoulder, LeftShoulder, RightHip, LeftHip
local HandlePart, HandleMesh, HandleWeld
local AnimateScript

local RunService = game:GetService("RunService")
local Animation_Speed = 1.95
local Speed = 16
local SINE = 0
local CHANGE = 2 / Animation_Speed
local ATTACK = false
local Rooted = false
local HOLD = false
local KEYHOLD = false
local ANIM = "Idle"
local WALK = 0
local WALKINGANIM = false
local HITFLOOR = nil
local Player_Size = 1
local ROOTC0 = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180))
local NECKC0 = CFrame.new(0, 1, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180))
local RIGHTSHOULDERC0 = CFrame.new(-0.5, 0, 0) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0))
local LEFTSHOULDERC0 = CFrame.new(0.5, 0, 0) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0))

local function Swait(NUMBER)
    if NUMBER == 0 or NUMBER == nil then
        RunService.RenderStepped:Wait()
    else
        for i = 1, NUMBER do
            RunService.RenderStepped:Wait()
        end
    end
end

local function Raycast(POSITION, DIRECTION, RANGE, IGNOREDECENDANTS)
    return workspace:FindPartOnRay(Ray.new(POSITION, DIRECTION.unit * RANGE), IGNOREDECENDANTS)
end

local function QuaternionFromCFrame(cf)
    local mx, my, mz, m00, m01, m02, m10, m11, m12, m20, m21, m22 = cf:components()
    local trace = m00 + m11 + m22
    if trace > 0 then
        local s = math.sqrt(1 + trace)
        local recip = 0.5 / s
        return (m21 - m12) * recip, (m02 - m20) * recip, (m10 - m01) * recip, s * 0.5
    else
        local i = 0
        if m11 > m00 then i = 1 end
        if m22 > (i == 0 and m00 or m11) then i = 2 end
        if i == 0 then
            local s = math.sqrt(m00 - m11 - m22 + 1)
            local recip = 0.5 / s
            return 0.5 * s, (m10 + m01) * recip, (m20 + m02) * recip, (m21 - m12) * recip
        elseif i == 1 then
            local s = math.sqrt(m11 - m22 - m00 + 1)
            local recip = 0.5 / s
            return (m01 + m10) * recip, 0.5 * s, (m21 + m12) * recip, (m02 - m20) * recip
        elseif i == 2 then
            local s = math.sqrt(m22 - m00 - m11 + 1)
            local recip = 0.5 / s
            return (m02 + m20) * recip, (m12 + m21) * recip, 0.5 * s, (m10 - m01) * recip
        end
    end
end

local function QuaternionToCFrame(px, py, pz, x, y, z, w)
    local xs, ys, zs = x + x, y + y, z + z
    local wx, wy, wz = w * xs, w * ys, w * zs
    local xx = x * xs
    local xy = x * ys
    local xz = x * zs
    local yy = y * ys
    local yz = y * zs
    local zz = z * zs
    return CFrame.new(px, py, pz, 1 - (yy + zz), xy - wz, xz + wy, xy + wz, 1 - (xx + zz), yz - wx, xz - wy, yz + wx, 1 - (xx + yy))
end

local function QuaternionSlerp(a, b, t)
    local cosTheta = a[1] * b[1] + a[2] * b[2] + a[3] * b[3] + a[4] * b[4]
    local startInterp, finishInterp
    if cosTheta >= 0.0001 then
        if (1 - cosTheta) > 0.0001 then
            local theta = math.acos(cosTheta)
            local invSinTheta = 1 / math.sin(theta)
            startInterp = math.sin((1 - t) * theta) * invSinTheta
            finishInterp = math.sin(t * theta) * invSinTheta
        else
            startInterp = 1 - t
            finishInterp = t
        end
    else
        if (1 + cosTheta) > 0.0001 then
            local theta = math.acos(-cosTheta)
            local invSinTheta = 1 / math.sin(theta)
            startInterp = math.sin((t - 1) * theta) * invSinTheta
            finishInterp = math.sin(t * theta) * invSinTheta
        else
            startInterp = t - 1
            finishInterp = t
        end
    end
    return a[1] * startInterp + b[1] * finishInterp, a[2] * startInterp + b[2] * finishInterp, a[3] * startInterp + b[3] * finishInterp, a[4] * startInterp + b[4] * finishInterp
end

local function Clerp(a, b, t)
    local qa = {QuaternionFromCFrame(a)}
    local qb = {QuaternionFromCFrame(b)}
    local ax, ay, az = a.x, a.y, a.z
    local bx, by, bz = b.x, b.y, b.z
    local _t = 1 - t
    return QuaternionToCFrame(_t * ax + t * bx, _t * ay + t * by, _t * az + t * bz, QuaternionSlerp(qa, qb, t))
end

local function BANSLAM()
    ATTACK = true
    Rooted = false
    repeat
        for i = 0, 0.2, 0.1 / Animation_Speed do
            Swait()
            if HandleWeld then HandleWeld.C0 = Clerp(HandleWeld.C0, CFrame.new(0, -0.8, 0) * CFrame.Angles(math.rad(-90), math.rad(-45), math.rad(0)), 2 / Animation_Speed) end
            RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, 7) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(0)), 2 / Animation_Speed)
            Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(25), math.rad(0), math.rad(0)), 2 / Animation_Speed)
            RightShoulder.C0 = Clerp(RightShoulder.C0, CFrame.new(1, 0.5, 0.5) * CFrame.Angles(math.rad(250), math.rad(0), math.rad(-45)) * RIGHTSHOULDERC0, 2 / Animation_Speed)
            LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1, 0.5, 0.5) * CFrame.Angles(math.rad(250), math.rad(0), math.rad(45)) * LEFTSHOULDERC0, 2 / Animation_Speed)
            RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 2 / Animation_Speed)
            LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 2 / Animation_Speed)
        end
        for i = 0, 0.08, 0.1 / Animation_Speed do
            Swait()
            if HandleWeld then HandleWeld.C0 = Clerp(HandleWeld.C0, CFrame.new(0, -1, 0) * CFrame.Angles(math.rad(-90), math.rad(-45), math.rad(0)), 2 / Animation_Speed) end
            RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, 2) * CFrame.Angles(math.rad(75), math.rad(0), math.rad(0)), 2 / Animation_Speed)
            Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-25), math.rad(0), math.rad(0)), 2 / Animation_Speed)
            RightShoulder.C0 = Clerp(RightShoulder.C0, CFrame.new(1, 0.5, -1) * CFrame.Angles(math.rad(120), math.rad(0), math.rad(-45)) * RIGHTSHOULDERC0, 2 / Animation_Speed)
            LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1, 0.5, -1) * CFrame.Angles(math.rad(120), math.rad(0), math.rad(45)) * LEFTSHOULDERC0, 2 / Animation_Speed)
            RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 0.5 / Animation_Speed)
            LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 0.5 / Animation_Speed)
        end
        for i = 0, 0.08, 0.1 / Animation_Speed do
            Swait()
            if HandleWeld then HandleWeld.C0 = Clerp(HandleWeld.C0, CFrame.new(0, -1, 0) * CFrame.Angles(math.rad(-70), math.rad(-45), math.rad(0)), 2 / Animation_Speed) end
            RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, 2) * CFrame.Angles(math.rad(75), math.rad(0), math.rad(0)), 2 / Animation_Speed)
            Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-25), math.rad(0), math.rad(0)), 2 / Animation_Speed)
            RightShoulder.C0 = Clerp(RightShoulder.C0, CFrame.new(1, 0.5, -1) * CFrame.Angles(math.rad(60), math.rad(0), math.rad(-45)) * RIGHTSHOULDERC0, 2 / Animation_Speed)
            LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1, 0.5, -1) * CFrame.Angles(math.rad(60), math.rad(0), math.rad(45)) * LEFTSHOULDERC0, 2 / Animation_Speed)
            RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 0.5 / Animation_Speed)
            LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 0.5 / Animation_Speed)
        end

        local slamPos = (RootPart.CFrame * CFrame.new(0, 0, -6)).p
        local slamCFrame = RootPart.CFrame * CFrame.new(0, -5, -6)
        Tool.BanEvent:FireServer("Slam", slamPos, 25, slamCFrame)

        for i = 0, 0.1, 0.1 / Animation_Speed do
            Swait()
            if HandleWeld then HandleWeld.C0 = Clerp(HandleWeld.C0, CFrame.new(0, -1, 0) * CFrame.Angles(math.rad(-70), math.rad(-45), math.rad(0)), 2 / Animation_Speed) end
            RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, 1.8) * CFrame.Angles(math.rad(75), math.rad(0), math.rad(0)), 2 / Animation_Speed)
            Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-25), math.rad(0), math.rad(0)), 2 / Animation_Speed)
            RightShoulder.C0 = Clerp(RightShoulder.C0, CFrame.new(1, 0.5, -1) * CFrame.Angles(math.rad(60), math.rad(0), math.rad(-45)) * RIGHTSHOULDERC0, 2 / Animation_Speed)
            LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1, 0.5, -1) * CFrame.Angles(math.rad(60), math.rad(0), math.rad(45)) * LEFTSHOULDERC0, 2 / Animation_Speed)
            RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 0.5 / Animation_Speed)
            LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 0.5 / Animation_Speed)
        end
        if HOLD == true then
            for i = 0, 0.08, 0.1 / Animation_Speed do
                Swait()
                if HOLD == false then break end
                if HandleWeld then HandleWeld.C0 = Clerp(HandleWeld.C0, CFrame.new(0, -1, 0) * CFrame.Angles(math.rad(-90), math.rad(-45), math.rad(0)), 2 / Animation_Speed) end
                RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, 2) * CFrame.Angles(math.rad(75), math.rad(0), math.rad(0)), 2 / Animation_Speed)
                Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-25), math.rad(0), math.rad(0)), 2 / Animation_Speed)
                RightShoulder.C0 = Clerp(RightShoulder.C0, CFrame.new(1, 0.5, -1) * CFrame.Angles(math.rad(120), math.rad(0), math.rad(-45)) * RIGHTSHOULDERC0, 2 / Animation_Speed)
                LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1, 0.5, -1) * CFrame.Angles(math.rad(120), math.rad(0), math.rad(45)) * LEFTSHOULDERC0, 2 / Animation_Speed)
                RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 0.5 / Animation_Speed)
                LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(25)), 0.5 / Animation_Speed)
            end
        end
    until HOLD == false
    ATTACK = false
    Rooted = false
end

Tool.Equipped:Connect(function()
    Tool.RequiresHandle = false
    local existingHandle = Tool:FindFirstChild("Handle")
    if existingHandle and existingHandle:IsA("BasePart") then
        existingHandle.Transparency = 1
        existingHandle.CanCollide = false
    end

    Character = Player.Character
    Humanoid = Character:FindFirstChildOfClass("Humanoid")
    RootPart = Character:FindFirstChild("HumanoidRootPart")
    Torso = Character:FindFirstChild("Torso") or Character:FindFirstChild("UpperTorso")
    Head = Character:FindFirstChild("Head")
    RightArm = Character:FindFirstChild("Right Arm") or Character:FindFirstChild("RightHand")
    LeftArm = Character:FindFirstChild("Left Arm") or Character:FindFirstChild("LeftHand")
    RightLeg = Character:FindFirstChild("Right Leg") or Character:FindFirstChild("RightFoot")
    LeftLeg = Character:FindFirstChild("Left Leg") or Character:FindFirstChild("LeftFoot")

    if Torso:FindFirstChild("RootJoint") then RootJoint = Torso.RootJoint end
    if RootPart:FindFirstChild("RootJoint") then RootJoint = RootPart.RootJoint end
    Neck = Torso:FindFirstChild("Neck")
    RightShoulder = Torso:FindFirstChild("Right Shoulder")
    LeftShoulder = Torso:FindFirstChild("Left Shoulder")
    RightHip = Torso:FindFirstChild("Right Hip")
    LeftHip = Torso:FindFirstChild("Left Hip")

    AnimateScript = Character:FindFirstChild("Animate")
    if AnimateScript then AnimateScript.Disabled = true end

    if Humanoid then
        for _, track in ipairs(Humanoid:GetPlayingAnimationTracks()) do
            track:Stop()
        end
    end

    Tool.BanEvent:FireServer("Equip")

    local WeaponModel = Character:WaitForChild("Adds", 5)
    if WeaponModel then
        HandlePart = WeaponModel:WaitForChild("Handle", 5)
        if HandlePart then
            HandleWeld = HandlePart:WaitForChild("HandleWeld", 5)
        end
    end

    local sick = Instance.new("Sound", Character)
    sick.Name = "BanMusic"
    sick.SoundId = "rbxassetid://462506896"
    sick.Looped = true
    sick.Pitch = 1
    sick.Volume = 5
    sick:Play()
end)

Tool.Unequipped:Connect(function()
    Tool.BanEvent:FireServer("Unequip")
    if AnimateScript then AnimateScript.Disabled = false end
    if Character and Character:FindFirstChild("BanMusic") then Character.BanMusic:Destroy() end
    ATTACK = false

    if RootJoint then
        RootJoint.C0 = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180))
        RootJoint.C1 = CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180))
    end
    if Neck then
        Neck.C0 = CFrame.new(0, 1, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180))
        Neck.C1 = CFrame.new(0, -0.5, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180))
    end
    if RightShoulder then
        RightShoulder.C0 = CFrame.new(1, 0.5, 0) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0))
        RightShoulder.C1 = CFrame.new(-0.5, 0.5, 0) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0))
    end
    if LeftShoulder then
        LeftShoulder.C0 = CFrame.new(-1, 0.5, 0) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0))
        LeftShoulder.C1 = CFrame.new(0.5, 0.5, 0) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0))
    end
    if RightHip then
        RightHip.C0 = CFrame.new(1, -1, 0) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0))
        RightHip.C1 = CFrame.new(0.5, 1, 0) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0))
    end
    if LeftHip then
        LeftHip.C0 = CFrame.new(-1, -1, 0) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0))
        LeftHip.C1 = CFrame.new(-0.5, 1, 0) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0))
    end
end)

Tool.Activated:Connect(function()
    HOLD = true
    if ATTACK == false then
        BANSLAM()
    end
end)

Tool.Deactivated:Connect(function()
    HOLD = false
end)

Mouse.KeyDown:Connect(function(Key)
    KEYHOLD = true
    if Key == "b" and ATTACK == false and RootPart then
        local pos = RootPart.Position
        RootPart.CFrame = CFrame.new(Mouse.Hit.p + Vector3.new(0, 3, 0), pos)
        Tool.BanEvent:FireServer("TeleportSound")
    end
end)

Mouse.KeyUp:Connect(function(Key)
    KEYHOLD = false
end)

task.spawn(function()
    while true do
        Swait()
        if Tool.Parent == Character and ATTACK == false and RootPart and Humanoid then
            SINE = SINE + CHANGE
            local TORSOVELOCITY = (RootPart.Velocity * Vector3.new(1, 0, 1)).magnitude
            local TORSOVERTICALVELOCITY = RootPart.Velocity.y
            HITFLOOR = Raycast(RootPart.Position, (CFrame.new(RootPart.Position, RootPart.Position + Vector3.new(0, -1, 0))).lookVector, 4 * Player_Size, Character)
            local WALKSPEEDVALUE = 6 / (Humanoid.WalkSpeed / 16)

            RightShoulder.C0 = Clerp(RightShoulder.C0, CFrame.new(1.5, 0, 0) * CFrame.Angles(math.rad(200), math.rad(90), math.rad(0)) * RIGHTSHOULDERC0, 0.2 / Animation_Speed)
            if HandleWeld then HandleWeld.C0 = Clerp(HandleWeld.C0, CFrame.new(0, -0.8, 0) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(0)), 0.2 / Animation_Speed) end

            if ANIM == "Walk" and TORSOVELOCITY > 1 then
                RootJoint.C1 = Clerp(RootJoint.C1, ROOTC0 * CFrame.new(0, 0, -0.15 * math.cos(SINE / (WALKSPEEDVALUE / 2)) * Player_Size) * CFrame.Angles(math.rad(0), math.rad(0) - RootPart.RotVelocity.Y / 75, math.rad(0)), 2 * (Humanoid.WalkSpeed / 16) / Animation_Speed)
                Neck.C1 = Clerp(Neck.C1, CFrame.new(0 * Player_Size, -0.5 * Player_Size, 0 * Player_Size) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180)) * CFrame.Angles(math.rad(2.5 * math.sin(SINE / (WALKSPEEDVALUE / 2))), math.rad(0), math.rad(0) - Head.RotVelocity.Y / 30), 0.2 * (Humanoid.WalkSpeed / 16) / Animation_Speed)
                RightHip.C1 = Clerp(RightHip.C1, CFrame.new(0.5 * Player_Size, 0.875 * Player_Size - 0.125 * math.sin(SINE / WALKSPEEDVALUE) * Player_Size, -0.125 * math.cos(SINE / WALKSPEEDVALUE) * Player_Size) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(0) - RightLeg.RotVelocity.Y / 75, math.rad(0), math.rad(76 * math.cos(SINE / WALKSPEEDVALUE))), 0.2 * (Humanoid.WalkSpeed / 16) / Animation_Speed)
                LeftHip.C1 = Clerp(LeftHip.C1, CFrame.new(-0.5 * Player_Size, 0.875 * Player_Size + 0.125 * math.sin(SINE / WALKSPEEDVALUE) * Player_Size, 0.125 * math.cos(SINE / WALKSPEEDVALUE) * Player_Size) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(0) + LeftLeg.RotVelocity.Y / 75, math.rad(0), math.rad(76 * math.cos(SINE / WALKSPEEDVALUE))), 0.2 * (Humanoid.WalkSpeed / 16) / Animation_Speed)
            elseif (ANIM ~= "Walk") or (TORSOVELOCITY < 1) then
                RootJoint.C1 = Clerp(RootJoint.C1, ROOTC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(0)), 0.2 / Animation_Speed)
                Neck.C1 = Clerp(Neck.C1, CFrame.new(0 * Player_Size, -0.5 * Player_Size, 0 * Player_Size) * CFrame.Angles(math.rad(-90), math.rad(0), math.rad(180)) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(0)), 0.2 / Animation_Speed)
                RightHip.C1 = Clerp(RightHip.C1, CFrame.new(0.5 * Player_Size, 1 * Player_Size, 0 * Player_Size) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(0)), 0.2 / Animation_Speed)
                LeftHip.C1 = Clerp(LeftHip.C1, CFrame.new(-0.5 * Player_Size, 1 * Player_Size, 0 * Player_Size) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(0)), 0.2 / Animation_Speed)
            end

            if TORSOVERTICALVELOCITY > 1 and HITFLOOR == nil then
                ANIM = "Jump"
                RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(0)), 0.2 / Animation_Speed)
                Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(-20), math.rad(0), math.rad(0)), 0.2 / Animation_Speed)
                LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1.5, 0.5, 0) * CFrame.Angles(math.rad(-40), math.rad(0), math.rad(-20)) * LEFTSHOULDERC0, 0.2 / Animation_Speed)
                RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1, -0.3) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(-5), math.rad(0), math.rad(-20)), 0.2 / Animation_Speed)
                LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1, -0.3) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(-5), math.rad(0), math.rad(20)), 0.2 / Animation_Speed)
            elseif TORSOVERTICALVELOCITY < -1 and HITFLOOR == nil then
                ANIM = "Fall"
                RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(0)), 0.2 / Animation_Speed)
                Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(20), math.rad(0), math.rad(0)), 0.2 / Animation_Speed)
                LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1.5, 0.5, 0) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(-60)) * LEFTSHOULDERC0, 0.2 / Animation_Speed)
                RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1, 0) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(20)), 0.2 / Animation_Speed)
                LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1, 0) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(10)), 0.2 / Animation_Speed)
            elseif TORSOVELOCITY < 1 and HITFLOOR ~= nil then
                ANIM = "Idle"
                RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, 0 + 0.05 * math.cos(SINE / 12)) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(0)), 0.15 / Animation_Speed)
                Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(0 - 2.5 * math.sin(SINE / 12)), math.rad(0), math.rad(0)), 0.15 / Animation_Speed)
                LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1.5, 0.5, 0) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(-12)) * LEFTSHOULDERC0, 0.15 / Animation_Speed)
                RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(0)), 0.15 / Animation_Speed)
                LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1 - 0.05 * math.cos(SINE / 12), -0.01) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(-8), math.rad(0), math.rad(0)), 0.15 / Animation_Speed)
            elseif TORSOVELOCITY > 1 and HITFLOOR ~= nil then
                ANIM = "Walk"
                WALK = WALK + 1 / Animation_Speed
                if WALK >= 15 - (5 * (Humanoid.WalkSpeed / 16 / Player_Size)) then
                    WALK = 0
                    WALKINGANIM = not WALKINGANIM
                end
                RootJoint.C0 = Clerp(RootJoint.C0, ROOTC0 * CFrame.new(0, 0, -0.1) * CFrame.Angles(math.rad(5), math.rad(0), math.rad(0)), 0.15 / Animation_Speed)
                Neck.C0 = Clerp(Neck.C0, NECKC0 * CFrame.new(0, 0, 0) * CFrame.Angles(math.rad(5 - 8 * math.sin(SINE / (WALKSPEEDVALUE / 2))), math.rad(0), math.rad(0)), 0.15 / Animation_Speed)
                LeftShoulder.C0 = Clerp(LeftShoulder.C0, CFrame.new(-1.5, 0.5, 0) * CFrame.Angles(math.rad(-60 * math.cos(SINE / WALKSPEEDVALUE)), math.rad(0), math.rad(-5)) * LEFTSHOULDERC0, 0.35 / Animation_Speed)
                RightHip.C0 = Clerp(RightHip.C0, CFrame.new(1, -1 - 0.15 * math.cos(SINE / WALKSPEEDVALUE), -0.2 + 0.2 * math.cos(SINE / WALKSPEEDVALUE)) * CFrame.Angles(math.rad(0), math.rad(90), math.rad(0)) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(-15)), 2 / Animation_Speed)
                LeftHip.C0 = Clerp(LeftHip.C0, CFrame.new(-1, -1 - 0.15 * math.cos(SINE / WALKSPEEDVALUE), -0.2 + -0.2 * math.cos(SINE / WALKSPEEDVALUE)) * CFrame.Angles(math.rad(0), math.rad(-90), math.rad(0)) * CFrame.Angles(math.rad(0), math.rad(0), math.rad(15)), 2 / Animation_Speed)
            end

            if Rooted == false then
                Humanoid.WalkSpeed = Speed
            elseif Rooted == true then
                Humanoid.WalkSpeed = 0
            end
        end
    end
end)