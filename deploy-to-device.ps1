$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "$env:USERPROFILE\.gradle"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"
Set-Location "$PSScriptRoot\android"
.\gradlew.bat --stop
.\gradlew.bat installDebug -PreactNativeDevServerPort=8081
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n com.myandroidapp/.MainActivity
