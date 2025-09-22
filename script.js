// --- Custom Body Connections ---
// This array defines the connections for a basic "stick figure" body,
// omitting the face, hands, and feet for a cleaner look.
const BODY_CONNECTIONS = [
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Arms
  [11, 13], [13, 15], [12, 14], [14, 16],
  // Legs
  [23, 25], [25, 27], [24, 26], [26, 28]
];

// --- Get HTML elements ---
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const canvasCtx = canvasElement.getContext('2d');
const videoUpload = document.getElementById('video_upload');

// --- Logic for loading the video file ---
videoUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    videoElement.src = url;
    videoElement.play();
  }
});

// --- Main callback function ---
function onResults(results) {
  // Set canvas size to match the video dimensions
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  // Draw the video frame and the pose results
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.poseLandmarks) {
    // Use our custom list of connections to draw only the body
    drawConnectors(canvasCtx, results.poseLandmarks, BODY_CONNECTIONS, {color: '#00FF00', lineWidth: 4});

    const landmarks = results.poseLandmarks;

    // Draw a single dot for the head (using the nose)
    const nose = landmarks[0];
    canvasCtx.beginPath();
    canvasCtx.arc(nose.x * canvasElement.width, nose.y * canvasElement.height, 7, 0, 2 * Math.PI);
    canvasCtx.fillStyle = '#00FFFF'; // Cyan for the head
    canvasCtx.fill();

    // Draw the body landmarks (including shoulders)
    for (let i = 11; i < landmarks.length; i++) {
      const landmark = landmarks[i];
      canvasCtx.beginPath();
      canvasCtx.arc(landmark.x * canvasElement.width, landmark.y * canvasElement.height, 5, 0, 2 * Math.PI);
      canvasCtx.fillStyle = '#FF0000'; // Red for the body
      canvasCtx.fill();
    }
  }
}

// --- MediaPipe Pose setup ---
const pose = new Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
});

pose.setOptions({
  modelComplexity: 2,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onResults);

// --- Video Processing Loop ---
async function videoLoop() {
  // If the video is playing, send the current frame to MediaPipe
  if (!videoElement.paused && !videoElement.ended) {
    await pose.send({image: videoElement});
  }
  // Request the next frame to create a continuous loop
  requestAnimationFrame(videoLoop);
}

// Start the loop when the video starts playing
videoElement.addEventListener('play', videoLoop);
