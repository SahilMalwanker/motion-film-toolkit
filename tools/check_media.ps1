param([Parameter(Mandatory = $true)][string]$Path)

# Opens the file with the Windows media stack (WPF MediaPlayer over Media Foundation)
# and reports whether Windows itself finds decodable audio and video.
Add-Type -AssemblyName PresentationCore, WindowsBase
$player = New-Object System.Windows.Media.MediaPlayer
$state = @{ Opened = $false; Failed = $null }
$player.add_MediaOpened({ $state.Opened = $true })
$player.add_MediaFailed({ param($s, $e) $state.Failed = $e.ErrorException.Message })
$player.Volume = 0
$player.Open([Uri](Resolve-Path $Path).Path)
$dispatcher = [System.Windows.Threading.Dispatcher]::CurrentDispatcher
$deadline = [DateTime]::UtcNow.AddSeconds(15)
while (-not $state.Opened -and -not $state.Failed -and [DateTime]::UtcNow -lt $deadline) {
    $frame = New-Object System.Windows.Threading.DispatcherFrame
    [void]$dispatcher.BeginInvoke([System.Windows.Threading.DispatcherPriority]::Background, [Action]{ $frame.Continue = $false })
    [System.Windows.Threading.Dispatcher]::PushFrame($frame)
    [System.Threading.Thread]::Sleep(50)
}
[pscustomobject]@{
    Opened   = $state.Opened
    Failed   = $state.Failed
    HasAudio = $player.HasAudio
    HasVideo = $player.HasVideo
    Width    = $player.NaturalVideoWidth
    Height   = $player.NaturalVideoHeight
    Duration = if ($player.NaturalDuration.HasTimeSpan) { $player.NaturalDuration.TimeSpan.TotalSeconds } else { $null }
} | Format-List
$player.Close()
