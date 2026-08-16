[aimassist_v3.js](https://github.com/user-attachments/files/31123167/aimassist_v3.js)
$done({
    body: JSON.stringify({
        status: 200,
        data: {
            aimAssist: {
                enabled: true,
                strength: 1.0,
                fov: 150,
                headshotPriority: 1,
                lockSpeed: 200,
                smoothness: 0
            },
            recoil: { vertical: 0, horizontal: 0 },
            spread: { base: 0, max: 0, moving: 0 }
        }
    })
});
