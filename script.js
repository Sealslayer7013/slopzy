// Find our HTML elements from the page
const videoElement = document.getElementById('video_player');
const videoUpload = document.getElementById('video_upload');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackElement = document.getElementById("feedback");

// --- State Variables for Tracking and Rep Counting ---
let lockedOnPerson = null;
const LOCK_ON_DISTANCE_THRESHOLD = 400;
const TRACKING_CONTINUITY_THRESHOLD = 300;
let repCounter = 0;
let repState = 'down';

// --- Logic for loading the video file ---
videoUpload.addEventListener('change', (e) => {
  lockedOnPerson = null;
  repCounter = 0;
  repState = 'down';
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    videoElement.src = url;
    videoElement.load();
    videoElement.play();
  }
});

// --- Helper Functions ---
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

function getDistance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCenter(landmarks) {
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  return {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };
}

// --- Main Analysis Function ---
function onResults(results) {
  canvasElement.width = videoElement.clientWidth;
  canvasElement.height = videoElement.clientHeight;
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  const allDetectedPeople = results.poseLandmarks ? [results.poseLandmarks] : [];

  let bestCandidate = null;
  if (lockedOnPerson === null) {
    let minDistance = LOCK_ON_DISTANCE_THRESHOLD;
    const screenCenter = { x: 0.5, y: 0.5 }; // Normalized coordinates
    for (const personLandmarks of allDetectedPeople) {
      const personCenter = getCenter(personLandmarks);
      const distance = getDistance(personCenter, screenCenter);
      if (distance < minDistance) {
        minDistance = distance;
        bestCandidate = personLandmarks;
      }
    }
  } else {
    let minDistance = TRACKING_CONTINUITY_THRESHOLD;
    const lockedOnCenter = getCenter(lockedOnPerson);
    for (const personLandmarks of allDetectedPeople) {
      const personCenter = getCenter(personLandmarks);
      const distance = getDistance(personCenter, lockedOnCenter);
      if (distance < minDistance) {
        minDistance = distance;
        bestCandidate = personLandmarks;
      }
    }
  }
  lockedOnPerson = bestCandidate;

  if (lockedOnPerson) {
    drawConnectors(canvasCtx, lockedOnPerson, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(canvasCtx, lockedOnPerson, {color: '#FF0000', radius: 2});

    const leftShoulder = lockedOnPerson[11];
    const leftElbow = lockedOnPerson[13];
    const leftWrist = lockedOnPerson[15];
    const elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);

    let feedbackText = "";
    if (elbowAngle > 160) {
      repState = 'down';
      feedbackText = "Good form!";
    }
    if (repState === 'up' && elbowAngle > 40) {
        feedbackText = "Bring it all the way up!";
    }
    if (elbowAngle < 40 && repState === 'down') {
      repState = 'up';
      repCounter++;
      feedbackText = "Good rep!";
    }

    feedbackElement.innerHTML = `Reps: ${repCounter} | Angle: ${Math.round(elbowAngle)}<br>${feedbackText}`;
  } else {
    feedbackElement.innerHTML = "Looking for person...";
  }
}

// --- MediaPipe Setup ---
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

pose.onResults(onResults);

// --- Video Processing Loop ---
async function videoLoop() {
  if (!videoElement.paused && !videoElement.ended) {
    await pose.send({image: videoElement});
  }
  requestAnimationFrame(videoLoop);
}

videoElement.addEventListener('play', videoLoop);
videoElement.addEventListener('playing', videoLoop);
