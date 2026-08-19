export async function checkBrowserMediaSupport() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error("❌ WebRTC MediaDevices API is not supported in this browser environment.");
    return { supported: false, error: "API_UNSUPPORTED" };
  }

  try {
    // Probe hardware constraints
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some(device => device.kind === 'videoinput');
    const hasMic = devices.some(device => device.kind === 'audioinput');

    console.log(`🟢 [Media Support Check]: Camera Found: ${hasCamera}, Microphone Found: ${hasMic}`);
    return { supported: true, hasCamera, hasMic };
  } catch (err) {
    console.warn("⚠️ Media device enumeration warning:", err);
    return { supported: true, hasCamera: true, hasMic: true }; // Assume true and let getUserMedia prompt permissions
  }
}

export async function requestUserMediaStream(audio = true, video = true) {
  try {
    const constraints = {
      audio: audio,
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log("🟢 [Media Stream Acquired]: Local Media Tracks active:", stream.getTracks().map(t => t.kind));
    return stream;
  } catch (err) {
    console.error("❌ [Media Access Denied]: User rejected camera/microphone permissions or device is in use.", err);
    throw err;
  }
}