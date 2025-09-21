// Find our HTML elements from the page
const videoElement = document.getElementById('video_player');
const videoUpload = document.getElementById('video_upload');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackElement = document.getElementById("feedback");

// --- State Variables for Tracking ---
let lockedOnPerson = null; // This will store the landmarks of the person we are tracking.
const LOCK_ON_DISTANCE_THRESHOLD = 400; // Max distance in pixels from center to lock on.
const TRACKING_CONTINUITY_THRESHOLD = 300; // Max distance in pixels a person can move between frames.

// --- State Variables for Rep Counting ---
let repCounter = 0;
let repState = 'down'; // Can be 'down' or 'up'

// --- Logic for loading the video file ---
videoUpload.addEventListener('change', (e) => {
  // When a new file is uploaded, reset the tracking and rep counter
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
    x: (leftHip.x + rightHip.x) / 2 * canvasElement.width,
    y: (leftHip.y + rightHip.y) / 2 * canvasElement.height,
  };
}

// --- Main Analysis Function ---
function onResults(results) {
  // Set the canvas to the video's current size and clear it
  canvasElement.width = videoElement.clientWidth;
  canvasElement.height = videoElement.clientHeight;
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw the video frame onto the canvas
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  // Get the list of all people detected, or an empty list if none.
  // Note: The code review was correct, but MediaPipe Pose for JS seems to have a bug
  // or undocumented feature where it returns `poseLandmarks` for the first person
  // and not `multiPoseLandmarks`. We will handle both cases to be safe.
  const allDetectedPeople = results.multiPoseLandmarks || (results.poseLandmarks ? [results.poseLandmarks] : []);

  // Find the best person to track from the list.
  let bestCandidate = null;
  if (lockedOnPerson === null) {
    // If we are not tracking anyone, find the person closest to the center.
    let minDistance = LOCK_ON_DISTANCE_THRESHOLD;
    const screenCenter = { x: canvasElement.width / 2, y: canvasElement.height / 2 };
    for (const personLandmarks of allDetectedPeople) {
      const personCenter = getCenter(personLandmarks);
      const distance = getDistance(personCenter, screenCenter);
      if (distance < minDistance) {
        minDistance = distance;
        bestCandidate = personLandmarks;
      }
    }
  } else {
    // If we are already tracking someone, find the person closest to their last known position.
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

  // --- This section only runs if we have a locked-on person ---
  if (lockedOnPerson) {
    drawConnectors(canvasCtx, lockedOnPerson, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
    drawLandmarks(canvasCtx, lockedOnPerson, {color: '#FF0000', radius: 2});

    // --- Bicep Curl Analysis ---
    const leftShoulder = lockedOnPerson[11];
    const leftElbow = lockedOnPerson[13];
    const leftWrist = lockedOnPerson[15];

    const elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);

    // Rep counting and feedback logic
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

    // Update the feedback element
    feedbackElement.innerHTML = `Reps: ${repCounter} | Angle: ${Math.round(elbowAngle)}<br>${feedbackText}`;
  } else {
    feedbackElement.innerHTML = "Looking for skier...";
  }
}

// --- MediaPipe Setup ---
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
  modelComplexity: 2,
  smoothLandmarks: true,
  minDetectionConfidence: 0.75,
  minTrackingConfidence: 0.75,
});

pose.onResults(onResults);

// --- Video Processing Loop ---
async function processFrame() {
  if (!videoElement.paused && !videoElement.ended) {
    await pose.send({image: videoElement});
    requestAnimationFrame(processFrame);
  }
}

videoElement.addEventListener('play', () => requestAnimationFrame(processFrame));
videoElement.addEventListener('playing', () => requestAnimationFrame(processFrame));
