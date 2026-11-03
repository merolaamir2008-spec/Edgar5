// @ts-nocheck

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    set,
    get,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";


// =============================
// FIREBASE CONNECTION
// =============================

const firebaseConfig = {
    apiKey: "AIzaSyBZH51ED-KTOsP055wHTxatHBU3Z5w07b4",
    authDomain: "tic-tac-toe-6e362.firebaseapp.com",
    databaseURL: "https://tic-tac-toe-6e362-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tic-tac-toe-6e362",
    storageBucket: "tic-tac-toe-6e362.firebasestorage.app",
    messagingSenderId: "581473126185",
    appId: "1:581473126185:web:e7fab64e50167767c51938",
    measurementId: "G-D1MDHHLD88"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const database = getDatabase(app);

let currentUser = null;
let currentRoomCode = "";
let roomListener = null;
let onlineGameStarted = false;
let gameListener = null;
let onlineMovePending = false;

// Sign in anonymously

signInAnonymously(auth)
    .catch(function(error) {
        console.error("Firebase sign-in failed:", error);
        alert("Couldn't connect to the online service. Check your internet connection.");
    });

onAuthStateChanged(auth, function(user) {

    if (user) {
        currentUser = user;

        console.log("Firebase connected. Player ID:", user.uid);
    }

});

// =============================
// 1. LOADING SCREEN
// =============================

let progress = 0;

let loadingInterval = setInterval(function() {

progress += 1;  

document.getElementById("progress").style.width = progress + "%";  

if (progress >= 100) {  

    clearInterval(loadingInterval);  

    document.getElementById("loading-screen").classList.add("hidden");  

    document.getElementById("main-menu").classList.remove("hidden");  

}

}, 15);


// =============================
// 2. SCREEN NAVIGATION
// =============================

let screenHistory = [];

let screens = [
    "main-menu",
    "friend-menu",
    "computer-screen",
    "symbol-screen",
    "create-screen",
    "join-screen",
    "join-wait-screen",
    "game-screen"
];

// Start with the main menu as the first screen
history.replaceState({ screen: "main-menu" }, "");

function showScreen(screenId, addToHistory = true) {

    let currentScreen = screens.find(function(id) {
        return !document.getElementById(id).classList.contains("hidden");
    });

    // Save the current screen before moving forward
    if (addToHistory && currentScreen && currentScreen !== screenId) {
        screenHistory.push(currentScreen);

        history.pushState({ screen: screenId }, "");
    }

    // Hide all screens
    screens.forEach(function(id) {
        document.getElementById(id).classList.add("hidden");
    });

    // Show the requested screen
    document.getElementById(screenId).classList.remove("hidden");
}

// Use this for normal Back buttons
function goBackScreen() {

    if (screenHistory.length > 0) {
        history.back();
    } else {
        showScreen("main-menu", false);
    }

}

// Android Back button
window.addEventListener("popstate", function() {

    let previousScreen = screenHistory.pop();

    if (previousScreen) {
        showScreen(previousScreen, false);
    } else {
        showScreen("main-menu", false);
    }

});


// =============================
// 3. CREATE A ROOM
// =============================

async function createRoom() {
    if (!currentUser) {
        alert("Still connecting. Please try again.");
        return;
    }

    if (roomListener) {
        roomListener();
        roomListener = null;
    }

    onlineGameStarted = false;

    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const roomCode = Array.from(
        { length: 6 },
        () => characters[Math.floor(Math.random() * characters.length)]
    ).join("");

    currentRoomCode = roomCode;

    const status = document.getElementById("room-status");
    const startButton = document.getElementById("start-game");

    document.getElementById("room-code").textContent = roomCode;
    status.textContent = "Connecting to Firebase...";
    document.getElementById("host-symbol").textContent = "X";
    document.getElementById("host-name").textContent = "YOU";
    document.getElementById("guest-symbol").textContent = "O";
    document.getElementById("guest-name").textContent = "YOUR FRIEND";
    document.getElementById("friend-status").textContent = "WAITING";
    document.getElementById("lobby-message").textContent =
        "Waiting for your friend to join...";
    startButton.disabled = true;

    showScreen("create-screen");

    const roomData = {
        hostUid: currentUser.uid,
        status: "waiting",
        createdAt: Date.now()
    };

    try {
        const roomRef = ref(database, "rooms/" + roomCode);
        await set(roomRef, roomData);

        status.textContent = "Ready to join! Send your friend the code.";

        roomListener = onValue(roomRef, function(snapshot) {
            const room = snapshot.val();

            if (!room) return;

            if (room.guestUid && room.status === "connected") {
                document.getElementById("friend-status").textContent =
                    "CONNECTED";

                document.getElementById("lobby-message").textContent =
                    "Your friend has joined! You can start the game.";

                startButton.disabled = false;
            }
        });

        console.log("Room created:", roomCode);

    } catch (error) {
        console.error("Room creation failed:", error);
        status.textContent = "Connection failed. Please try again.";
    }
}


// =============================
// 4. JOIN A ROOM
// =============================
const joinCodeInput = document.getElementById("join-code");
const submitCodeButton = document.getElementById("submit-code");

joinCodeInput.addEventListener("input", function() {
    joinCodeInput.value = joinCodeInput.value
        .toUpperCase()
        .replace(/\s/g, "");

    submitCodeButton.disabled = joinCodeInput.value.length !== 6;
});

function joinRoom() {
    document.getElementById("join-status").textContent = "";
    document.getElementById("join-code").value = "";
    document.getElementById("submit-code").disabled = true;

    showScreen("join-screen");
}


async function submitJoinRoom() {
    const code = document.getElementById("join-code").value.trim().toUpperCase();
    const joinButton = document.getElementById("submit-code");
    const joinStatus = document.getElementById("join-status");

    if (code.length !== 6) return;

    if (!currentUser) {
        joinStatus.textContent = "Connecting to the server. Please wait...";
        return;
    }

    joinButton.disabled = true;
    joinStatus.textContent = "Joining room...";

    try {
        const roomRef = ref(database, "rooms/" + code);
        const snapshot = await get(roomRef);

        if (!snapshot.exists()) {
            joinStatus.textContent = "Room not found. Check the code.";
            joinButton.disabled = false;
            return;
        }

        const room = snapshot.val();

        if (room.hostUid === currentUser.uid) {
            joinStatus.textContent = "You cannot join your own room.";
            joinButton.disabled = false;
            return;
        }

        if (room.status !== "waiting" || room.guestUid) {
            joinStatus.textContent = "This room is already full.";
            joinButton.disabled = false;
            return;
        }

        await update(roomRef, {
            guestUid: currentUser.uid,
            status: "connected"
        });

        currentRoomCode = code;
        onlineGameStarted = false;

        if (roomListener) {
            roomListener();
            roomListener = null;
        }

        // Show the joiner's waiting screen
document.getElementById("waiting-message").textContent =
    "Waiting for the host to start the game...";

showScreen("join-wait-screen");


        // Wait for the host to start the match
        roomListener = onValue(roomRef, function(updatedSnapshot) {
            const updatedRoom = updatedSnapshot.val();

            if (updatedRoom && updatedRoom.status === "playing") {
                startOnlineGame("O");
            }
        });

        joinStatus.textContent = "";

    } catch (error) {
        console.error("Joining room failed:", error);

        joinStatus.textContent =
            "Couldn't join. Please check your connection and try again.";

        joinButton.disabled = false;
    }
}


// =============================
// HOST STARTS THE MATCH
// =============================

async function startOnlineMatch() {
    if (!currentUser || !currentRoomCode) return;

    const startButton = document.getElementById("start-game");
    startButton.disabled = true;

    try {
        // Change the room status so the guest can enter the game
        await update(ref(database, "rooms/" + currentRoomCode), {
            status: "playing"
        });

        // Create the initial shared board
        await set(ref(database, "games/" + currentRoomCode), {
            board: ".........",
            currentPlayer: "X",
            updatedBy: currentUser.uid
        });

        startOnlineGame("X");

    } catch (error) {
        console.error("Couldn't start the game:", error);

        document.getElementById("lobby-message").textContent =
            "Couldn't start the game. Please try again.";

        startButton.disabled = false;
    }
}


// =============================
// 5. BUTTON EVENTS
// =============================

document.getElementById("play-friend").addEventListener("click", function() {
showScreen("friend-menu");
});

document.getElementById("play-computer").addEventListener("click", function() {
showScreen("computer-screen");
});

document.getElementById("create-room").addEventListener("click", createRoom);

document.getElementById("join-room").addEventListener("click", joinRoom);

document.getElementById("submit-code").addEventListener("click", submitJoinRoom);

document.getElementById("start-game").addEventListener("click", startOnlineMatch);

document.getElementById("back-friend").addEventListener("click", goBackScreen);

document.getElementById("back-create").addEventListener("click", goBackScreen);

document.getElementById("back-join").addEventListener("click", goBackScreen);

// =============================
// 6. COPY ROOM CODE
// =============================

document.getElementById("copy-code").addEventListener("click", function() {

let code = document.getElementById("room-code").textContent;  

navigator.clipboard.writeText(code);  

document.getElementById("copy-code").textContent = "Copied!";

});

// =============================
// 7. COMPUTER DIFFICULTY
// =============================

let computerDifficulty = "";

function chooseDifficulty(level) {
    computerDifficulty = level;
    showScreen("symbol-screen");
}  



document.getElementById("easy").addEventListener("click", function() {
chooseDifficulty("Easy");
});

document.getElementById("medium").addEventListener("click", function() {
chooseDifficulty("Medium");
});

document.getElementById("hard").addEventListener("click", function() {
chooseDifficulty("Hard");
});

document.getElementById("back-computer").addEventListener("click", goBackScreen);

document.getElementById("back-symbol").addEventListener("click", goBackScreen);

// =============================
// 8. GAME MODE AND PLAYER SETUP
// =============================

let gameMode = "offline";

let playerSymbol = "X";

let computerSymbol = "O";

let computerTimer = null;

let victoryTimer = null;

// Start a computer game

function startComputerGame(symbol) {

gameMode = "computer";  

playerSymbol = symbol;  

computerSymbol = symbol === "X" ? "O" : "X";  

resetGame();  

// Update player names  

document.querySelector("#player-x .player-name").textContent =  
    playerSymbol === "X" ? "YOU" : "COMPUTER";  

document.querySelector("#player-o .player-name").textContent =  
    playerSymbol === "O" ? "YOU" : "COMPUTER";  

showScreen("game-screen");  

// Computer starts if the player chose O  

if (computerSymbol === "X") {  
    scheduleComputerMove();  
}

}

// Start an online game
function startOnlineGame(symbol) {
    if (onlineGameStarted) return;

    onlineGameStarted = true;
    gameMode = "online";
    playerSymbol = symbol;
    onlineMovePending = false;

    resetGame();

    document.querySelector("#player-x .player-name").textContent =
        symbol === "X" ? "YOU" : "FRIEND";

    document.querySelector("#player-o .player-name").textContent =
        symbol === "O" ? "YOU" : "FRIEND";

    showScreen("game-screen");

    // Listen for board updates from both players
    if (gameListener) {
        gameListener();
        gameListener = null;
    }

    const gameRef = ref(database, "games/" + currentRoomCode);

    gameListener = onValue(gameRef, function(snapshot) {
        const game = snapshot.val();

        if (!game || !game.board) return;

        // Convert the shared board into our local board
        board = game.board.split("").map(function(cell) {
            return cell === "." ? "" : cell;
        });

        // Update the visible squares
        cells.forEach(function(cell, index) {
            cell.textContent = board[index];

            cell.classList.remove("x-mark", "o-mark");

            if (board[index] === "X") {
                cell.classList.add("x-mark");
            } else if (board[index] === "O") {
                cell.classList.add("o-mark");
            }
        });

        onlineMovePending = false;

        // Check whether the latest move ended the game
        const lastPlayer = game.currentPlayer === "X" ? "O" : "X";
        currentPlayer = lastPlayer;

        if (getWinner(board) || !board.includes("")) {
            checkWinner();
            return;
        }

        // Otherwise, use Firebase's turn
        currentPlayer = game.currentPlayer;
        updateTurnDisplay();
    });
}


async function submitOnlineMove(index) {
    if (
        !currentUser ||
        !currentRoomCode ||
        !gameActive ||
        onlineMovePending ||
        currentPlayer !== playerSymbol ||
        board[index] !== ""
    ) {
        return;
    }

    onlineMovePending = true;

    const newBoard = board.slice();
    newBoard[index] = playerSymbol;

    const nextPlayer = playerSymbol === "X" ? "O" : "X";

    try {
        await update(ref(database, "games/" + currentRoomCode), {
            board: newBoard.map(function(cell) {
                return cell === "" ? "." : cell;
            }).join(""),
            currentPlayer: nextPlayer,
            updatedBy: currentUser.uid
        });

    } catch (error) {
        console.error("Online move failed:", error);
        onlineMovePending = false;

        document.getElementById("turn-message").textContent =
            "Move failed. Please try again.";
    }
}



// Symbol selection buttons

document.getElementById("choose-x").addEventListener("click", function() {
startComputerGame("X");
});

document.getElementById("choose-o").addEventListener("click", function() {
startComputerGame("O");
});

// =============================
// 9. TIC TAC TOE GAME
// =============================

let board = ["", "", "", "", "", "", "", "", ""];

let currentPlayer = "X";

let gameActive = true;

let cells = document.querySelectorAll(".cell");

let winningCombinations = [
[0, 1, 2],
[3, 4, 5],
[0, 3, 6],
[1, 4, 7],
[2, 5, 8],
[0, 4, 8],
[2, 4, 6]
];

// Update the turn message and active player


function updateTurnDisplay() {
    let message = currentPlayer + "'s turn";

    if (gameMode === "computer") {
        message = currentPlayer === playerSymbol
            ? "Your turn"
            : "Computer's turn";
    }

    if (gameMode === "online") {
        message = currentPlayer === playerSymbol
            ? "Your turn"
            : "Friend's turn";
    }

    document.getElementById("turn-message").textContent = message;

    document.getElementById("player-x").classList.toggle(
        "active-player",
        currentPlayer === "X"
    );

    document.getElementById("player-o").classList.toggle(
        "active-player",
        currentPlayer === "O"
    );

    // Lock the board during the computer's turn
    const computerThinking =
        gameMode === "computer" &&
        currentPlayer === computerSymbol;

    cells.forEach(function(cell) {
        cell.disabled = !gameActive || computerThinking;
    });
}


// Play a move

function playMove(index, isComputerMove = false) {

if (board[index] !== "" || !gameActive) {  
    return;  
}  

  // Online moves must be sent through Firebase
if (gameMode === "online") {
    submitOnlineMove(index);
    return;
}

// Prevent the human from playing during the computer's turn  

if (
    gameMode === "computer" &&
    currentPlayer === computerSymbol &&
    !isComputerMove
) {
    return;
}

board[index] = currentPlayer;  

cells[index].textContent = currentPlayer;  

cells[index].classList.add(  
    currentPlayer === "X" ? "x-mark" : "o-mark"  
);  

let gameEnded = checkWinner();  

if (gameEnded) {  
    return;  
}  

// Let the computer play after the human  

if (  
    gameMode === "computer" &&  
    currentPlayer === computerSymbol  
) {  
    scheduleComputerMove();  
}

}

// =============================
// 10. CHECK WINNER AND DRAW
// =============================

function getWinner(state) {

for (let combination of winningCombinations) {  

    let [a, b, c] = combination;  

    if (  
        state[a] !== "" &&  
        state[a] === state[b] &&  
        state[a] === state[c]  
    ) {  
        return state[a];  
    }  

}  

return null;

}

function checkWinner() {

// Check whether X or O has won  

let winner = getWinner(board);  

if (winner !== null) {  

    let winningCombination = winningCombinations.find(function(combination) {  

        let [a, b, c] = combination;  

        return (  
            board[a] === winner &&  
            board[b] === winner &&  
            board[c] === winner  
        );  

    });  


    // Draw the winning line  

    let firstCell = cells[winningCombination[0]];  
    let lastCell = cells[winningCombination[2]];  

    let boardRect = document.getElementById("game-board").getBoundingClientRect();  

    let firstRect = firstCell.getBoundingClientRect();  
    let lastRect = lastCell.getBoundingClientRect();  

    let scale = 300 / boardRect.width;  

    let x1 = (firstRect.left + firstRect.width / 2 - boardRect.left) * scale;  
    let y1 = (firstRect.top + firstRect.height / 2 - boardRect.top) * scale;  

    let x2 = (lastRect.left + lastRect.width / 2 - boardRect.left) * scale;  
    let y2 = (lastRect.top + lastRect.height / 2 - boardRect.top) * scale;  

    let dx = x2 - x1;  
    let dy = y2 - y1;  

    let length = Math.sqrt(dx * dx + dy * dy);  

    let extension = 23;  

    x1 -= (dx / length) * extension;  
    y1 -= (dy / length) * extension;  

    x2 += (dx / length) * extension;  
    y2 += (dy / length) * extension;  

    let winLine = document.getElementById("win-line");  

    winLine.setAttribute("x1", x1);  
    winLine.setAttribute("y1", y1);  
    winLine.setAttribute("x2", x2);  
    winLine.setAttribute("y2", y2);  

    let winningLine = document.getElementById("winning-line");  

    winningLine.style.display = "block";  

    // Restart the winning line animation  

    winningLine.classList.remove("animate-win");  

    winLine.style.strokeDashoffset = "500";  

    void winningLine.offsetWidth;  

    winningLine.classList.add("animate-win");  


    // Stop the game and show the correct winner  

    gameActive = false;  

    victoryTimer = setTimeout(function() {  
        showVictory(winner);  
    }, 750);  

    return true;  

}  


// Check for a draw  

if (!board.includes("")) {  

    gameActive = false;  

    victoryTimer = setTimeout(function() {  
        showVictory("draw");  
    }, 250);  

    return true;  

}  


// Switch turns  

currentPlayer = currentPlayer === "X" ? "O" : "X";  

updateTurnDisplay();  

return false;

}

// =============================
// 11. VICTORY AND DEFEAT SCREEN
// =============================

function showVictory(winner) {

let overlay = document.getElementById("victory-overlay");  

let card = document.getElementById("victory-card");  

let symbol = document.getElementById("victory-symbol");  

let title = document.getElementById("victory-title");  

let subtitle = document.getElementById("victory-subtitle");  

let message = document.getElementById("game-message");  


// Clear previous styles  

card.classList.remove("draw-state");  

symbol.classList.remove("o-winner");  

title.classList.remove("o-winner");  

symbol.textContent = "";  

message.textContent = "";  


// Draw  

if (winner === "draw") {  

    card.classList.add("draw-state");  

    title.textContent = "IT'S A DRAW!";  

    subtitle.textContent = "EVENLY MATCHED";  

    message.textContent = "";  

}  

// Someone won  

else {  

    symbol.textContent = winner;  

    if (winner === "O") {  
        symbol.classList.add("o-winner");  
        title.classList.add("o-winner");  
    }  

    if (gameMode === "computer") {  

        if (winner === playerSymbol) {  

            title.textContent = "YOU WIN!";  

            subtitle.textContent = "";  

            message.textContent = "";  

        } else {  

            title.textContent = "YOU LOST!";  

            subtitle.textContent = "BETTER LUCK NEXT TIME";  

            message.textContent = "";  

        }  

    } else {  

        title.textContent = winner + " WINS!";  

        subtitle.textContent = "";  

        message.textContent = winner + " takes the victory!";  

    }  

}  


overlay.classList.remove("hidden");

}

// =============================
// 12. COMPUTER AI
// =============================

// Get all available cells

function getAvailableMoves(state) {

let moves = [];  

for (let i = 0; i < state.length; i++) {  

    if (state[i] === "") {  
        moves.push(i);  
    }  

}  

return moves;

}

// Easy: Random move

function easyMove() {

let moves = getAvailableMoves(board);  

let randomIndex = Math.floor(Math.random() * moves.length);  

return moves[randomIndex];

}

// Check whether a symbol can win in one move

function findWinningMove(state, symbol) {

for (let i = 0; i < state.length; i++) {  

    if (state[i] === "") {  

        state[i] = symbol;  

        let winner = getWinner(state);  

        state[i] = "";  

        if (winner === symbol) {  
            return i;  
        }  

    }  

}  

return null;

}

// Medium: Smart, but not perfect

function mediumMove() {

let moves = getAvailableMoves(board);  

// 1. ALWAYS take an immediate winning move  
let winningMove = findWinningMove(board, computerSymbol);  

if (winningMove !== null) {  
    return winningMove;  
}  

// 2. Usually block the player's immediate win  
let blockingMove = findWinningMove(board, playerSymbol);  

if (blockingMove !== null && Math.random() < 0.7) {  
    return blockingMove;  
}  

// 3. Sometimes make a random move  
if (Math.random() < 0.35) {  
    return moves[Math.floor(Math.random() * moves.length)];  
}  

// 4. Prefer the center  
if (board[4] === "") {  
    return 4;  
}  

// 5. Prefer corners  
let corners = [0, 2, 6, 8].filter(function(index) {  
    return board[index] === "";  
});  

if (corners.length > 0) {  
    return corners[Math.floor(Math.random() * corners.length)];  
}  

// 6. Otherwise choose any available cell  
return moves[Math.floor(Math.random() * moves.length)];

}

// Hard: Minimax algorithm

function minimax(state, turn, depth) {

let winner = getWinner(state);  

// Computer wins  
if (winner === computerSymbol) {  
    return { score: 10 - depth };  
}  

// Human wins  
if (winner === playerSymbol) {  
    return { score: depth - 10 };  
}  

// Draw  
if (!state.includes("")) {  
    return { score: 0 };  
}  

let moves = getAvailableMoves(state);  
let bestMove = null;  

// Computer tries to maximize its score  
if (turn === computerSymbol) {  

    let bestScore = -Infinity;  

    for (let move of moves) {  

        state[move] = computerSymbol;  

        let result = minimax(state, playerSymbol, depth + 1);  

        state[move] = "";  

        if (  
            result.score > bestScore ||  
            (result.score === bestScore && Math.random() < 0.5)  
        ) {  

            bestScore = result.score;  
            bestMove = move;  

        }  
    }  

    return {  
        score: bestScore,  
        move: bestMove  
    };  

}  

// Human tries to minimize the computer's score  
else {  

    let bestScore = Infinity;  

    for (let move of moves) {  

        state[move] = playerSymbol;  

        let result = minimax(state, computerSymbol, depth + 1);  

        state[move] = "";  

        if (  
            result.score < bestScore ||  
            (result.score === bestScore && Math.random() < 0.5)  
        ) {  

            bestScore = result.score;  
            bestMove = move;  

        }  
    }  

    return {  
        score: bestScore,  
        move: bestMove  
    };  

}

}

// Hard: Minimax algorithm

function hardMove() {

// Always take an immediate win  
let winningMove = findWinningMove(board, computerSymbol);  

if (winningMove !== null) {  
    return winningMove;  
}  

// Always block an immediate player win  
let blockingMove = findWinningMove(board, playerSymbol);  

if (blockingMove !== null) {  
    return blockingMove;  
}  

// Otherwise, use Minimax to find the best move  
let result = minimax(board.slice(), computerSymbol, 0);  

return result.move;

}

// Choose a move based on difficulty

function getComputerMove() {

if (computerDifficulty === "Easy") {  
    return easyMove();  
}  

if (computerDifficulty === "Medium") {  
    return mediumMove();  
}  

if (computerDifficulty === "Hard") {  
    return hardMove();  
}  

return easyMove();

}

// =============================
// 13. COMPUTER TURN
// =============================

function scheduleComputerMove() {

if (!gameActive) {  
    return;  
}  

clearTimeout(computerTimer);  

computerTimer = setTimeout(function() {  

    if (!gameActive || currentPlayer !== computerSymbol) {  
        return;  
    }  

    let move = getComputerMove();  

    if (move !== null && move !== undefined) {  

        playMove(move, true);  

    }  

}, 650);

}

// =============================
// 14. RESET GAME
// =============================

function resetGame() {

clearTimeout(computerTimer);  

clearTimeout(victoryTimer);  

computerTimer = null;  

victoryTimer = null;  

board = ["", "", "", "", "", "", "", "", ""];  

currentPlayer = "X";  

gameActive = true;  


// Clear the board  

cells.forEach(function(cell) {  

    cell.textContent = "";  

    cell.classList.remove("x-mark", "o-mark");  

});  


// Reset player cards  

if (gameMode === "computer") {  

    document.querySelector("#player-x .player-name").textContent =  
        playerSymbol === "X" ? "YOU" : "COMPUTER";  

    document.querySelector("#player-o .player-name").textContent =  
        playerSymbol === "O" ? "YOU" : "COMPUTER";  

} else {  

    document.querySelector("#player-x .player-name").textContent = "PLAYER 1";  

    document.querySelector("#player-o .player-name").textContent = "PLAYER 2";  

}  


// Reset turn display  

updateTurnDisplay();  

document.getElementById("game-message").textContent = "";  


// Hide victory overlay  

document.getElementById("victory-overlay").classList.add("hidden");  

document.getElementById("victory-card").classList.remove("draw-state");  

document.getElementById("victory-symbol").classList.remove("o-winner");  

document.getElementById("victory-title").classList.remove("o-winner");  


// Reset victory text  

document.getElementById("victory-symbol").textContent = "";  

document.getElementById("victory-title").textContent = "X WINS!";  

document.getElementById("victory-subtitle").textContent = "";  


// Reset winning line  

let winningLine = document.getElementById("winning-line");  

let winLine = document.getElementById("win-line");  

winningLine.classList.remove("animate-win");  

winningLine.style.display = "none";  

winLine.style.strokeDashoffset = "500";

}

// =============================
// 15. CONNECT BOARD BUTTONS
// =============================

cells.forEach(function(cell, index) {

cell.addEventListener("click", function() {  

    playMove(index);  

});

});

// =============================
// 16. OPEN OFFLINE GAME
// =============================

document.getElementById("test-board").addEventListener("click", function() {

gameMode = "offline";  

resetGame();  

showScreen("game-screen");

});

// =============================
// 17. REMATCH
// =============================

document.getElementById("rematch-button").addEventListener("click", function() {

resetGame();  

// Keep the previous difficulty and symbol  

// If the computer uses X, it starts again  

if (  
    gameMode === "computer" &&  
    computerSymbol === "X"  
) {  
    scheduleComputerMove();  
}

});

// =============================
// 18. BACK TO MENU
// =============================

document.getElementById("back-game").addEventListener("click", function() {

gameMode = "offline";  

resetGame();  

screenHistory = [];
showScreen("main-menu", false);
history.replaceState({ screen: "main-menu" }, "");
});