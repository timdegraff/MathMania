// --- DOM Element References ---
const difficultyScreen = document.getElementById('difficulty-selection-screen');
const missionScreen = document.getElementById('mission-selection-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const difficultyButtonsContainer = document.getElementById('difficulty-buttons');
const missionButtonsContainer = document.getElementById('mission-buttons');
const destinationPlanetName = document.getElementById('destination-planet-name');
const progressShip = document.getElementById('progress-bar-ship');
const fuelLevel = document.getElementById('fuel-level');
const fuelGainAnimation = document.getElementById('fuel-gain-animation');
const fuelLossAnimation = document.getElementById('fuel-loss-animation');
const problemContainer = document.getElementById('problem-container');
const answerInput = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-answer-btn');
const spaceship = document.getElementById('spaceship');
const asteroid = document.getElementById('asteroid');
const missionSuccessScreen = document.getElementById('mission-success');
const successTitle = document.getElementById('success-title');
const successImage = document.getElementById('success-image');
const missionFailureScreen = document.getElementById('mission-failure');
const finalScoreEl = document.getElementById('final-score');
const finalGradeEl = document.getElementById('final-grade');
const wrongAnswersContainer = document.getElementById('wrong-answers-container');
const replayBtn = document.getElementById('replay-btn');

// --- Game Configuration (Easy to Edit) ---
const gameConfig = {
    difficultyLevels: {
        'K-1': {
            label: 'Grades K-1',
            types: ['add'], // Only addition
            numberRange: [1, 9], // Range for generating numbers
            fuelDrainRate: 3.0 // % per second
        },
        '2-3': {
            label: 'Grades 2-3',
            types: ['add', 'subtract', 'multiply', 'divide'],
            numberRange: [2, 20],
            multDivRange: [2, 10],
            fuelDrainRate: 3.0 // % per second
        },
        '4-5': {
            label: 'Grades 4-5',
            types: ['add', 'subtract', 'multiply', 'divide', 'power'],
            numberRange: [10, 100],
            multDivRange: [2, 25],
            powerBaseRange: [2, 5],
            powerExpRange: [2, 3],
            fuelDrainRate: 3.0 // % per second
        },
        '6-8': {
            label: 'Grades 6-8',
            types: ['add', 'subtract', 'multiply', 'divide', 'power'],
            numberRange: [10, 200],
            multDivRange: [5, 50],
            powerBaseRange: [2, 10],
            powerExpRange: [2, 4],
            fuelDrainRate: 3.0 // % per second
        }
    },
    missions: {
        'Mars': {
            label: 'Mars',
            questions: 10,
            image: 'images/mars.png'
        },
        'Saturn': {
            label: 'Saturn',
            questions: 25,
            image: 'images/saturn.png'
        },
        'Pluto': {
            label: 'Pluto',
            questions: 50,
            image: 'images/pluto.png'
        }
    },
    fuel: {
        start: 100,
        gainOnCorrect: 8, // % gained
        lossOnIncorrect: 3 // % lost
    },
    animation: {
        flashDuration: 150, // ms
        fuelChangeDuration: 500 // ms
    }
};

// --- Game State Variables ---
let currentDifficulty = null;
let currentMission = null;
let problems = [];
let currentProblemIndex = 0;
let fuel = 0;
let fuelDrainInterval = null;
let wrongAnswers = [];

// --- Sound Effects ---
const clickSound = new Audio('sounds/click.mp3');
const correctSound = new Audio('sounds/correct.wav');
const incorrectSound = new Audio('sounds/incorrect.wav');
const successSound = new Audio('sounds/success.wav');
const failureSound = new Audio('sounds/failure.mp3');


function playSound(sound) {
    sound.currentTime = 0;
    sound.play().catch(e => console.error("Error playing sound:", e));
}

// --- Initial Game Setup ---
function init() {
    setupDifficultyScreen();
    submitBtn.addEventListener('click', handleSubmit);
    answerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    });
    replayBtn.addEventListener('click', restartGame);
}

// --- Screen Setup ---
function setupDifficultyScreen() {
    difficultyButtonsContainer.innerHTML = '';
    for (const key in gameConfig.difficultyLevels) {
        const button = document.createElement('button');
        button.textContent = gameConfig.difficultyLevels[key].label;
        button.onclick = () => selectDifficulty(key);
        difficultyButtonsContainer.appendChild(button);
    }
}

function setupMissionScreen() {
    missionButtonsContainer.innerHTML = '';
    for (const key in gameConfig.missions) {
        const mission = gameConfig.missions[key];
        const button = document.createElement('button');
        button.classList.add('mission-button');
        button.onclick = () => selectMission(key);

        const img = document.createElement('img');
        img.src = mission.image;
        img.alt = key;

        const infoDiv = document.createElement('div');
        infoDiv.classList.add('mission-info');
        
        const titleSpan = document.createElement('span');
        titleSpan.classList.add('planet-name');
        titleSpan.textContent = mission.label;
        
        const questionSpan = document.createElement('span');
        questionSpan.classList.add('question-count');
        questionSpan.textContent = `${mission.questions} Questions`;

        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(questionSpan);
        button.appendChild(img);
        button.appendChild(infoDiv);
        missionButtonsContainer.appendChild(button);
    }
}

// --- Game Flow ---
function selectDifficulty(key) {
    playSound(clickSound);
    currentDifficulty = key;
    difficultyScreen.classList.add('hidden');
    missionScreen.classList.remove('hidden');
    setupMissionScreen();
}

function selectMission(key) {
    playSound(clickSound);
    currentMission = key;
    missionScreen.classList.add('hidden');
    startGame();
}

function startGame() {
    // Reset state
    currentProblemIndex = 0;
    fuel = gameConfig.fuel.start;
    wrongAnswers = [];
    problems = generateProblems();
    
    // Setup UI
    destinationPlanetName.textContent = currentMission;
    updateFuelGauge();
    updateProgress();
    
    gameScreen.classList.remove('hidden');
    endScreen.classList.add('hidden');
    
    displayNextProblem();
    
    // Start fuel drain
    const drainRate = gameConfig.difficultyLevels[currentDifficulty].fuelDrainRate;
    if (fuelDrainInterval) clearInterval(fuelDrainInterval);
    fuelDrainInterval = setInterval(() => {
        fuel -= drainRate / 10; // Drain every 100ms for smoother feel
        updateFuelGauge();
        if (fuel <= 0) {
            endGame(false); // Mission failed
        }
    }, 100);
}

function displayNextProblem() {
    if (currentProblemIndex >= problems.length) {
        endGame(true); // Mission success
        return;
    }
    
    const problem = problems[currentProblemIndex];
    problemContainer.innerHTML = formatProblem(problem);
    answerInput.value = '';
    answerInput.focus();
}

function handleSubmit() {
    const userAnswer = parseInt(answerInput.value, 10);
    const correctAnswer = problems[currentProblemIndex].answer;

    if (isNaN(userAnswer)) return;

    if (userAnswer === correctAnswer) {
        handleCorrectAnswer();
    } else {
        handleIncorrectAnswer(userAnswer);
    }

    currentProblemIndex++;
    updateProgress();
    
    // Short delay before showing the next problem
    setTimeout(displayNextProblem, 500);
}

function handleCorrectAnswer() {
    playSound(correctSound);
    flashScreen(true);
    animateFuelChange(true);
}

function handleIncorrectAnswer(userAnswer) {
    playSound(incorrectSound);
    flashScreen(false);
    triggerAsteroidImpact();
    animateFuelChange(false);
    wrongAnswers.push({
        problem: problems[currentProblemIndex],
        userAnswer: userAnswer
    });
}

function endGame(success) {
    clearInterval(fuelDrainInterval);
    gameScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');

    if (success) {
        playSound(successSound);
        missionSuccessScreen.classList.remove('hidden');
        missionFailureScreen.classList.add('hidden');
        successTitle.textContent = `Touchdown on ${currentMission}!`;
        successImage.src = gameConfig.missions[currentMission].image;
    } else {
        playSound(failureSound);
        missionSuccessScreen.classList.add('hidden');
        missionFailureScreen.classList.remove('hidden');
    }

    displayResults();
}

function restartGame() {
    playSound(clickSound);
    endScreen.classList.add('hidden');
    difficultyScreen.classList.remove('hidden');
}

// --- UI & Animations ---
function updateFuelGauge() {
    fuel = Math.max(0, Math.min(100, fuel)); // Clamp between 0 and 100
    fuelLevel.style.height = `${fuel}%`;
}

function updateProgress() {
    const progress = (currentProblemIndex / problems.length) * 100;
    progressShip.style.width = `${progress}%`;
}

function flashScreen(isCorrect) {
    const color = isCorrect ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)';
    const flashDiv = document.createElement('div');
    flashDiv.style.position = 'fixed';
    flashDiv.style.top = '0';
    flashDiv.style.left = '0';
    flashDiv.style.width = '100%';
    flashDiv.style.height = '100%';
    flashDiv.style.backgroundColor = color;
    flashDiv.style.zIndex = '1000';
    flashDiv.style.opacity = '1';
    flashDiv.style.transition = 'opacity 0.2s ease-out';
    document.body.appendChild(flashDiv);
    
    setTimeout(() => {
        flashDiv.style.opacity = '0';
        setTimeout(() => document.body.removeChild(flashDiv), 200);
    }, gameConfig.animation.flashDuration);
}

function triggerAsteroidImpact() {
    asteroid.classList.remove('hidden', 'asteroid-impact');
    void asteroid.offsetWidth; // Trigger reflow
    asteroid.classList.add('asteroid-impact');
}

function animateFuelChange(isGain) {
    const amount = isGain ? gameConfig.fuel.gainOnCorrect : gameConfig.fuel.lossOnIncorrect;
    const animationEl = isGain ? fuelGainAnimation : fuelLossAnimation;
    
    const currentFuelHeight = fuelLevel.offsetHeight;
    const gaugeHeight = fuelLevel.parentElement.offsetHeight;
    const changeHeight = (amount / 100) * gaugeHeight;

    animationEl.style.height = `${changeHeight}px`;
    animationEl.style.bottom = `${currentFuelHeight}px`;
    animationEl.classList.remove('hidden');
    
    if (isGain) {
        fuel += amount;
    } else {
        fuel -= amount;
    }
    updateFuelGauge();

    setTimeout(() => {
        animationEl.classList.add('hidden');
        animationEl.style.height = '0';
    }, gameConfig.animation.fuelChangeDuration);
}

function displayResults() {
    const correctCount = problems.length - wrongAnswers.length;
    const percentage = Math.round((correctCount / problems.length) * 100);
    finalScoreEl.textContent = `Score: ${correctCount} / ${problems.length} (${percentage}%)`;
    finalGradeEl.textContent = `Grade: ${calculateGrade(percentage)}`;

    wrongAnswersContainer.innerHTML = '<h3>Review Your Mistakes</h3>';
    if (wrongAnswers.length === 0) {
        wrongAnswersContainer.innerHTML += '<p>Perfect Mission! No mistakes to review.</p>';
    } else {
        wrongAnswers.forEach(item => {
            const p = document.createElement('p');
            p.innerHTML = `
                ${formatProblem(item.problem, true)} 
                <span>Your Answer: <strong style="color: var(--fuel-red);">${item.userAnswer}</strong></span> | 
                <span>Correct: <strong style="color: var(--fuel-green);">${item.problem.answer}</strong></span>
            `;
            wrongAnswersContainer.appendChild(p);
        });
    }
}

// --- Problem Generation & Formatting ---
function generateProblems() {
    const { types, numberRange, multDivRange, powerBaseRange, powerExpRange } = gameConfig.difficultyLevels[currentDifficulty];
    const numQuestions = gameConfig.missions[currentMission].questions;
    const generated = [];

    for (let i = 0; i < numQuestions; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        let num1, num2, answer, operator;

        switch (type) {
            case 'add':
                if (currentDifficulty === 'K-1') {
                    // Specific logic for K-1: single digit answers, no zeros
                    num1 = rand(1, 8);
                    num2 = rand(1, 9 - num1);
                } else {
                    num1 = rand(numberRange[0], numberRange[1]);
                    num2 = rand(numberRange[0], numberRange[1]);
                }
                answer = num1 + num2;
                operator = '+';
                break;
            case 'subtract':
                num1 = rand(numberRange[0], numberRange[1]);
                num2 = rand(numberRange[0], num1); // Ensure result is not negative
                answer = num1 - num2;
                operator = '-';
                break;
            case 'multiply':
                const range = multDivRange;
                num1 = rand(range[0], range[1]);

                if (num1 >= 10) { // If num1 is a 2-digit number
                    if (num1 > 14) {
                        // num2 must be a 1-digit number (or 10)
                        num2 = rand(range[0], 10);
                    } else {
                        // if num1 is 10-14, num2 can be up to 14
                        num2 = rand(range[0], 14);
                    }
                } else { // if num1 is a 1-digit number
                    // num2 can be any number in the full range
                    num2 = rand(range[0], range[1]);
                }
                
                // Randomly swap to ensure variety (e.g., 8 x 15 vs 15 x 8)
                if (Math.random() > 0.5) {
                    [num1, num2] = [num2, num1];
                }

                answer = num1 * num2;
                operator = 'x';
                break;
            case 'divide':
                num2 = rand(multDivRange[0], multDivRange[1]);
                answer = rand(multDivRange[0], multDivRange[1]);
                num1 = num2 * answer; // Ensure whole number division
                operator = '÷';
                break;
            case 'power':
                num1 = rand(powerBaseRange[0], powerBaseRange[1]);
                num2 = rand(powerExpRange[0], powerExpRange[1]);
                answer = Math.pow(num1, num2);
                operator = '^';
                break;
        }
        generated.push({ num1, num2, operator, answer });
    }
    return generated;
}

function formatProblem(problem, isInline = false) {
    const { num1, num2, operator } = problem;
    if (operator === '^') {
        return isInline ? `${num1}<sup>${num2}</sup>` : `${num1}<sup>${num2}</sup>`;
    }
    if (operator === '÷') {
        return isInline ? `${num1} ÷ ${num2}` : `${num1} ÷ ${num2}`;
    }

    const topStr = String(num1);
    const bottomStr = `${operator} ${String(num2)}`;
    const width = Math.max(topStr.length, bottomStr.length);
    
    const paddedTop = topStr.padStart(width);
    const paddedBottom = bottomStr.padStart(width);

    // Return without the horizontal line
    return `${paddedTop}\n${paddedBottom}`;
}

// --- Helper Functions ---
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateGrade(percentage) {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
}

// --- Start the Application ---
document.addEventListener('DOMContentLoaded', init);
