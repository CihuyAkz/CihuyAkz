local TS = game:GetService("TweenService")
local runservice = game:GetService("RunService")
 
local tStyle, tDirection = {
[Enum.PoseEasingStyle.Linear] = Enum.EasingStyle.Linear;
[Enum.PoseEasingStyle.Bounce] = Enum.EasingStyle.Bounce;
[Enum.PoseEasingStyle.Cubic] = Enum.EasingStyle.Cubic;
[Enum.PoseEasingStyle.Elastic] = Enum.EasingStyle.Elastic;
[Enum.PoseEasingStyle.Constant] = Enum.EasingStyle.Linear;
},{
[Enum.PoseEasingDirection.In] = Enum.EasingDirection.In;
[Enum.PoseEasingDirection.Out] = Enum.EasingDirection.Out;
[Enum.PoseEasingDirection.InOut] = Enum.EasingDirection.InOut;
}
 
function PlayKeyframeSequence(Model, KeyFrameSequence, SpeedMult)
    local AllKeyFrames = {}
    
    for i,Keyframe in pairs(KeyFrameSequence:GetKeyframes()) do
        table.insert(AllKeyFrames, {
        Time = Keyframe.Time,
        Keyframe = Keyframe
        })
    end
    table.sort(AllKeyFrames, function(a, b)
        return a.Time < b.Time
    end)
    
    local tweens = {}
    local motors = {}
    local motorValues = {}
    local KeyFramePoses = {}
    
    local function GetMotorFromPose(Pose, Keyframe)
        local FullName = Pose:GetFullName()
        local Path = string.split(FullName, ".")
        local KFPosition = table.find(Path, Keyframe.Keyframe.Name)
        
        for i,v in pairs(Model:GetDescendants()) do
            if v:IsA("Motor6D") and v.Part1.Name == Pose.Name and v.Part0.Name == Pose.Parent.Name then
                return v
            end
        end
        return nil
    end
    
    
    for i,Keyframe in pairs(AllKeyFrames) do
        for x,Pose in pairs(Keyframe.Keyframe:GetDescendants()) do
            if Pose:IsA("Pose") and Pose.Weight>0 then
                local Motor6D = motors[Pose.Name] or GetMotorFromPose(Pose, Keyframe)
                if not KeyFramePoses[i] then
                    KeyFramePoses[i] = {
                    Time = Keyframe.Time,
                    Poses = {}
                    }
                end
                if not motors[Pose.Name] then
                    motors[Pose.Name] = Motor6D
                end
                if not motorValues[Pose.Name] then
                    local motorVal = Instance.new("CFrameValue")
                    motorVal.Name = "MotorValue"
                    motorVal.Parent = motors[Pose.Name]
                    motorValues[Pose.Name] = motorVal
                end
                
                if Motor6D then
                    KeyFramePoses[i].Poses[Pose.Name] = {Motor6D = Motor6D, Pose = Pose}
                end
            end
        end
    end
    
    if #KeyFramePoses-1>0 then
        print(KeyFramePoses)
        local lastPose = {}
        for i in ipairs(KeyFramePoses) do
            if i == #KeyFramePoses then break end
            
            local KF1, KF2 = KeyFramePoses[i], KeyFramePoses[i+1]
            local t = KF2.Time-KF1.Time
            
            tweens[i] = {
            Time = t,
            Tweens = {}
            }
            print(KF1.Time,KF2.Time)
            for name,data in pairs(KF1.Poses) do
                lastPose[name] = data
            end
            for name,data in pairs(KF2.Poses) do
                local tweeninfo = TweenInfo.new(
                math.abs(lastPose[name].Pose:FindFirstAncestorOfClass("Keyframe").Time-KF2.Time),
                tStyle[lastPose[name].Pose.EasingStyle],
                tDirection[lastPose[name].Pose.EasingDirection]
                )
                tweens[i].Tweens[name] = TS:Create(motorValues[name],tweeninfo,{Value=data.Pose.CFrame})
            end
        end
    end
    
    local function getLenght()
        return KeyFramePoses[#KeyFramePoses].Time
    end
    
    local function play()
        for i,v in pairs(tweens) do
            for x,tween in pairs(v.Tweens) do
                tween:Play()
            end
            task.wait(v.Time)
        end
    end
    
    runservice.Heartbeat:Connect(function()
        for i,v in pairs(motors) do
            v.Transform = motorValues[i].Value
        end
    end)
    
    while true do
        play()
    end
end
 
PlayKeyframeSequence(workspace.NPC,workspace.Idle)