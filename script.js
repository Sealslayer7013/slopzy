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
    drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});

    // Custom landmark drawing loop to skip face landmarks
    const landmarks = results.poseLandmarks;
    for (let i = 11; i < landmarks.length; i++) {
      const landmark = landmarks[i];
      canvasCtx.beginPath();
      canvasCtx.arc(landmark.x * canvasElement.width, landmark.y * canvasElement.height, 5, 0, 2 * Math.PI);
      canvasCtx.fillStyle = '#FF0000';
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
