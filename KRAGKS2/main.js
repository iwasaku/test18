// phina.js をグローバル領域に展開
phina.globalize();

// ゲーム定数
const FPS = 60;  // 60フレ
const FIELD_COL = 6;
const FIELD_ROW = 12;
const BLOCK_SIZE = 48;
const SCREEN_WIDTH = 480;
const SCREEN_HEIGHT = 640;
const SCREEN_CENTER_X = SCREEN_WIDTH / 2;   // スクリーン幅の半分
const SCREEN_CENTER_Y = SCREEN_HEIGHT / 2;  // スクリーン高さの半分
const PUYO_COLORS = ['#FF4136', '#2ECC40', '#0074D9', '#FFDC00', '#B10DC9', '#FF851B'];
const EMPTY_COLOR_ID = 0;
const BASE_FALL_INTERVAL = 800; // 落下間隔の基本値

// 共有ボタン用
let postText = null;
const postURL = "https://iwasaku.github.io/test18/KRAGKS2/";
const postTags = "#からあげKISS";

/*
*/
phina.define('LoadingScene', {
    superClass: 'DisplayScene',

    init: function (options) {
        this.superInit(options);
        // 背景色
        var self = this;
        var loader = phina.asset.AssetLoader();

        // 明滅するラベル
        let label = phina.display.Label({
            text: "",
            fontSize: 64,
            fill: 'white',
        }).addChildTo(this).setPosition(SCREEN_CENTER_X, SCREEN_CENTER_Y);

        // ロードが進行したときの処理
        loader.onprogress = function (e) {
            // 進捗具合を％で表示する
            label.text = "{0}%".format((e.progress * 100).toFixed(0));
        };

        // ローダーによるロード完了ハンドラ
        loader.onload = function () {
            // Appコアにロード完了を伝える（==次のSceneへ移行）
            self.flare('loaded');
        };

        // ロード開始
        loader.load(options.assets);
    },

});

/*
 */
phina.define("InitScene", {
    // 継承
    superClass: 'DisplayScene',
    // 初期化
    init: function (option) {
        // 親クラス初期化
        this.superInit(option);

        // フォント読み込み
        const font1 = document.fonts.load('10pt "misaki_gothic"');
        const font2 = document.fonts.load('10pt "icomoon"');

        // 両方のフォントが読み込めたら次へ
        Promise.all([font1, font2]).then(() => {
            this.exit();
        });
    }
});

phina.define("TitleScene", {
    // 継承
    superClass: 'DisplayScene',
    // 初期化
    init: function (option) {
        // 親クラス初期化
        this.superInit(option);

        // ラベル
        Label({
            text: 'からあげ\nKISS\n2',
            fontSize: 70,
            fontFamily: "misaki_gothic",
            fill: 'white',
        }).addChildTo(this).setPosition(this.gridX.center(), this.gridY.center() - (SCREEN_HEIGHT * 1 / 8));
        Label({
            text: 'TAP TO START',
            fontSize: 50,
            fontFamily: "misaki_gothic",
            fill: 'white',
        }).addChildTo(this).setPosition(SCREEN_CENTER_X, SCREEN_CENTER_Y + (SCREEN_HEIGHT * 1 / 4));
    },
    // タッチで次のシーンへ
    onpointstart: function () {
        this.exit();
    },
});

// メインシーン
phina.define('MainScene', {
    superClass: 'DisplayScene',

    init: function () {
        this.superInit({
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
        });

        // フィールド初期化
        this.field = Array.from({ length: FIELD_ROW }, () => Array(FIELD_COL).fill(EMPTY_COLOR_ID));
        this.currentPuyo = null;
        this.nextPuyo = null;
        this.score = 0;
        this.gameOver = false;
        this.chainCount = 0;
        this.maxChainCount = -1;
        this.isFastDropping = false;

        // スプライトグループ
        this.bgGroup = phina.display.DisplayElement().addChildTo(this);
        this.puyoGroup = phina.display.DisplayElement().addChildTo(this);
        this.fieldPuyoGroup = phina.display.DisplayElement().addChildTo(this);
        this.nextPuyoGroup = phina.display.DisplayElement().addChildTo(this);
        this.gameOverGroup = phina.display.DisplayElement().addChildTo(this);

        // UI
        this.scoreLabel = phina.display.Label({
            text: 'とくてん 0',
            fontSize: 24,
            fontFamily: "misaki_gothic",
            fill: 'white',
        }).addChildTo(this).setPosition(120, 40);

        this.chainLabel = phina.display.Label({
            text: '',
            fontSize: 64,
            fontFamily: "misaki_gothic",
            align: "center",
            fill: 'red',
            stroke: "white",
            strokeWidth: 1,
            shadow: "black",
            shadowBlur: 10,
        }).addChildTo(this).setPosition(SCREEN_CENTER_X, SCREEN_CENTER_Y);

        // Next表示エリア
        this.nextLabel = phina.display.Label({
            text: 'つぎ',
            fontSize: 20,
            fontFamily: "misaki_gothic",
            fill: 'white',
        }).addChildTo(this.bgGroup).setPosition(SCREEN_CENTER_X + (4 * BLOCK_SIZE), SCREEN_CENTER_Y - (4 * BLOCK_SIZE) - 10);

        // Next表示枠
        phina.display.RectangleShape({
            width: 60,
            height: 100,
            fill: null,
            stroke: 'white',
            strokeWidth: 2,
        }).addChildTo(this.bgGroup).setPosition(SCREEN_CENTER_X + (4 * BLOCK_SIZE), SCREEN_CENTER_Y - (3 * BLOCK_SIZE));

        // ゲームオーバー画面
        this.gameOverGroup.visible = false;

        // フィールド枠
        phina.display.RectangleShape({
            width: FIELD_COL * BLOCK_SIZE + 4,
            height: FIELD_ROW * BLOCK_SIZE + 4,
            fill: null,
            stroke: 'white',
            strokeWidth: 2,
        }).addChildTo(this.bgGroup).setPosition(SCREEN_CENTER_X, SCREEN_CENTER_Y + BLOCK_SIZE / 2);

        // 背景
        this.bgSprite = Sprite("bg").addChildTo(this.bgGroup).setPosition(SCREEN_CENTER_X, SCREEN_CENTER_Y + BLOCK_SIZE / 2).setSize(FIELD_COL * BLOCK_SIZE + 4, FIELD_ROW * BLOCK_SIZE + 4);
        this.bgSprite.alpha = 0.0;

        // タッチ・スワイプ処理
        this.setupTouchControls();

        // ゲーム開始
        this.startGame();

        // ゲームループ
        this.fallTimer = 0;
        this.fallInterval = BASE_FALL_INTERVAL;
    },

    setupTouchControls: function () {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.minSwipeDistance = 50;

        this.on('pointstart', function (e) {
            this.touchStartX = e.pointer.x;
            this.touchStartY = e.pointer.y;
        });

        this.on('pointend', function (e) {
            if (this.gameOver) {
                //    this.restartGame();
                return;
            }

            const deltaX = e.pointer.x - this.touchStartX;
            const deltaY = e.pointer.y - this.touchStartY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance < this.minSwipeDistance) {
                // タップ - 回転（画面の左右で回転方向を変える）
                if (e.pointer.x < SCREEN_WIDTH / 2) {
                    this.rotatePuyo(-1); // 左回転
                } else {
                    this.rotatePuyo(1);  // 右回転
                }
            } else {
                // スワイプ
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    // 水平スワイプ
                    if (deltaX > 0) {
                        this.movePuyo(1); // 右
                    } else {
                        this.movePuyo(-1); // 左
                    }
                } else {
                    // 垂直スワイプ
                    if (deltaY > 0) {
                        this.isFastDropping = true; // 下
                    }
                }
            }
        });
    },

    startGame: function () {
        this.field = Array.from({ length: FIELD_ROW }, () => Array(FIELD_COL).fill(EMPTY_COLOR_ID));
        this.score = 0;
        this.gameOver = false;
        this.chainCount = 0;
        this.maxChainCount = -1;
        this.isFastDropping = false;
        this.fallTimer = 0;

        this.scoreLabel.text = 'とくてん ' + this.score;
        this.chainLabel.text = '';
        this.gameOverGroup.visible = false;

        // 既存のスプライトをクリア
        this.puyoGroup.children.clear();
        this.fieldPuyoGroup.children.clear();
        this.nextPuyoGroup.children.clear();

        this.nextPuyo = this.createPuyoPair();
        this.spawnNewPuyo();
    },

    restartGame: function () {
        this.startGame();
    },

    createPuyoPair: function () {
        const difficultyLevels = [
            { scoreThreshold: 10000, colorCount: PUYO_COLORS.length - 2 },
            { scoreThreshold: 100000, colorCount: PUYO_COLORS.length - 1 },
        ];
        const currentLevel = difficultyLevels.find(level => this.score <= level.scoreThreshold);
        const colorMax = currentLevel ? currentLevel.colorCount : PUYO_COLORS.length;
        const color1 = PUYO_COLORS[Math.floor(Math.random() * colorMax)];
        const color2 = PUYO_COLORS[Math.floor(Math.random() * colorMax)];

        return {
            p1: { x: Math.floor(FIELD_COL / 2) - 1, y: 0, color: color1 },
            p2: { x: Math.floor(FIELD_COL / 2) - 1, y: -1, color: color2 },
            rotationState: 0
        };
    },

    spawnNewPuyo: function () {
        this.currentPuyo = this.nextPuyo;
        this.nextPuyo = this.createPuyoPair();

        // ゲームオーバー判定
        if (this.currentPuyo) {
            const p1 = this.currentPuyo.p1;
            const p2 = this.currentPuyo.p2;

            if ((p1.y >= 0 && this.field[p1.y][p1.x] !== EMPTY_COLOR_ID) ||
                (p2.y >= 0 && this.field[p2.y][p2.x] !== EMPTY_COLOR_ID)) {
                // ゲームオーバーの準備
                this._setupGameOverScreen();
                SoundManager.play("gameover");
                this.gameOver = true;
                this.gameOverGroup.visible = true;
                return;
            }
        }

        this.updatePuyoSprites();
        this.updateNextPuyoDisplay();
    },

    _setupGameOverScreen: function () {
        let postText = "からあげKISS 2\n" + this.score + "てん";
        if (this.maxChainCount > 1) {
            postText += "\n最大" + this.maxChainCount + "連鎖";
        }

        // for X
        const xButton = Button({
            text: String.fromCharCode(0xe902),
            fontSize: 24,
            fontFamily: "icomoon",
            fill: "#7575EF",
            stroke: '#DEE3FF',
            strokeWidth: 5,
            cornerRadius: 8,
            width: 48,
            height: 48,
        }).addChildTo(this.gameOverGroup).setPosition(SCREEN_CENTER_X - (SCREEN_CENTER_X / 2) - 60, SCREEN_CENTER_Y + (SCREEN_CENTER_Y / 2));
        xButton.onclick = () => {
            const shareURL = "https://x.com/intent/tweet?text=" + encodeURIComponent(postText + "\n" + postTags + "\n") + "&url=" + encodeURIComponent(postURL);
            window.open(shareURL);
        };

        // for Threads
        const threadsButton = Button({
            text: String.fromCharCode(0xe901),
            fontSize: 24,
            fontFamily: "icomoon",
            fill: "#7575EF",
            stroke: '#DEE3FF',
            strokeWidth: 5,
            cornerRadius: 8,
            width: 48,
            height: 48,
        }).addChildTo(this.gameOverGroup).setPosition(SCREEN_CENTER_X - (SCREEN_CENTER_X / 2), SCREEN_CENTER_Y + (SCREEN_CENTER_Y / 2));
        threadsButton.onclick = () => {
            const shareURL = "https://www.threads.net/intent/post?text=" + encodeURIComponent(postText + "\n\n" + postTags.replace(/#/g, "")) + "&url=" + encodeURIComponent(postURL);
            window.open(shareURL);
        };

        // for Bluesky
        const bskyButton = Button({
            text: String.fromCharCode(0xe900),
            fontSize: 24,
            fontFamily: "icomoon",
            fill: "#7575EF",
            stroke: '#DEE3FF',
            strokeWidth: 5,
            cornerRadius: 8,
            width: 48,
            height: 48,
        }).addChildTo(this.gameOverGroup).setPosition(SCREEN_CENTER_X - (SCREEN_CENTER_X / 2) + 60, SCREEN_CENTER_Y + (SCREEN_CENTER_Y / 2));
        bskyButton.onclick = () => {
            const shareURL = "https://bsky.app/intent/compose?text=" + encodeURIComponent(postText + "\n" + postTags + "\n" + postURL);
            window.open(shareURL);
        };

        // RESTARTボタンの表示
        const restartButton = Button({
            text: "RESTART",
            fontSize: 24,
            fontFamily: "misaki_gothic",
            align: "center",
            baseline: "middle",
            width: 150,
            height: 48,
            fill: "#B2B2B2",
            stroke: '#DEE3FF',
            strokeWidth: 5,
        }).addChildTo(this.gameOverGroup).setPosition(SCREEN_CENTER_X + (SCREEN_CENTER_X / 2), SCREEN_CENTER_Y + (SCREEN_CENTER_Y / 2));
        restartButton.onpush = () => this.init();

        const gameOverLabel = Label({
            text: "GAME OVER",
            fontSize: 96,
            fontFamily: "misaki_gothic",
            align: "center",
            fill: "white",
            stroke: "white",
            strokeWidth: 1,
            shadow: "black",
            shadowBlur: 10,
        }).addChildTo(this.gameOverGroup).setPosition(SCREEN_CENTER_X, SCREEN_CENTER_Y);
    },

    // ぷよスプライトの基本部分を生成する共通メソッド
    _createBasePuyoSprite: function (color) {
        // color（色の文字列）から配列のインデックス番号を取得
        const colorIndex = PUYO_COLORS.indexOf(color);
        const assetName = `ball_0${colorIndex}`;
        return Sprite(assetName).setSize(BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    },

    createPuyoSprite: function (color, x, y) {
        const sprite = this._createBasePuyoSprite(color);
        sprite.setPosition(
            (x + 0.5) * BLOCK_SIZE + (SCREEN_WIDTH - FIELD_COL * BLOCK_SIZE) / 2,
            (y + 0.5) * BLOCK_SIZE + (SCREEN_HEIGHT - FIELD_ROW * BLOCK_SIZE) / 2 + BLOCK_SIZE / 2
        );
        return sprite;
    },

    createNextPuyoSprite: function (color, offsetX, offsetY) {
        const sprite = this._createBasePuyoSprite(color);
        sprite.setPosition(SCREEN_CENTER_X + (4 * BLOCK_SIZE) + offsetX, SCREEN_CENTER_Y - (3 * BLOCK_SIZE) + offsetY);
        return sprite;
    },

    updateNextPuyoDisplay: function () {
        this.nextPuyoGroup.children.clear();

        if (this.nextPuyo) {
            // Next表示は常に縦向き（上下）で表示
            const p1Sprite = this.createNextPuyoSprite(this.nextPuyo.p1.color, 0, BLOCK_SIZE / 2);
            const p2Sprite = this.createNextPuyoSprite(this.nextPuyo.p2.color, 0, -BLOCK_SIZE / 2);

            p1Sprite.addChildTo(this.nextPuyoGroup);
            p2Sprite.addChildTo(this.nextPuyoGroup);
        }
    },

    updatePuyoSprites: function () {
        // 現在操作中のぷよスプライトをクリア
        this.puyoGroup.children.clear();

        // 現在のぷよを描画
        if (this.currentPuyo && !this.gameOver) {
            const p1Sprite = this.createPuyoSprite(this.currentPuyo.p1.color, this.currentPuyo.p1.x, this.currentPuyo.p1.y);
            const p2Sprite = this.createPuyoSprite(this.currentPuyo.p2.color, this.currentPuyo.p2.x, this.currentPuyo.p2.y);

            if (this.currentPuyo.p1.y >= 0) p1Sprite.addChildTo(this.puyoGroup);
            if (this.currentPuyo.p2.y >= 0) p2Sprite.addChildTo(this.puyoGroup);
        }
    },

    updateFieldSprites: function () {
        this.fieldPuyoGroup.children.clear();

        for (let y = 0; y < FIELD_ROW; y++) {
            for (let x = 0; x < FIELD_COL; x++) {
                if (this.field[y][x] !== EMPTY_COLOR_ID) {
                    const sprite = this.createPuyoSprite(this.field[y][x], x, y);
                    sprite.addChildTo(this.fieldPuyoGroup);
                }
            }
        }
    },

    movePuyo: function (direction) {
        if (!this.currentPuyo || this.gameOver) return;

        const newP1X = this.currentPuyo.p1.x + direction;
        const newP2X = this.currentPuyo.p2.x + direction;

        if (this.isStateValid(newP1X, this.currentPuyo.p1.y, newP2X, this.currentPuyo.p2.y)) {
            this.currentPuyo.p1.x = newP1X;
            this.currentPuyo.p2.x = newP2X;
            this.updatePuyoSprites();
        }
    },

    rotatePuyo: function (direction = 1) {
        if (!this.currentPuyo || this.gameOver) return;

        const newRotationState = (this.currentPuyo.rotationState + direction + 4) % 4;
        const p1 = this.currentPuyo.p1;
        const relPos = this.getP2RelativePosition(newRotationState);
        const newP2X = p1.x + relPos.x;
        const newP2Y = p1.y + relPos.y;

        // 壁ずらしを試行
        const xOffsetsToTry = [0, 1, -1];
        for (const offsetX of xOffsetsToTry) {
            const testP1X = p1.x + offsetX;
            const testP2X = newP2X + offsetX;

            if (this.isStateValid(testP1X, p1.y, testP2X, newP2Y)) {
                this.currentPuyo.p1.x = testP1X;
                this.currentPuyo.p2.x = testP2X;
                this.currentPuyo.p2.y = newP2Y;
                this.currentPuyo.rotationState = newRotationState;
                this.updatePuyoSprites();
                return;
            }
        }
    },

    getP2RelativePosition: function (rotationState) {
        switch (rotationState) {
            case 0: return { x: 0, y: -1 }; // 上
            case 1: return { x: 1, y: 0 };  // 右
            case 2: return { x: 0, y: 1 };  // 下
            case 3: return { x: -1, y: 0 }; // 左
            default: return { x: 0, y: -1 };
        }
    },

    isStateValid: function (p1x, p1y, p2x, p2y) {
        const p1CanOccupy = this.canPuyoOccupy(p1x, p1y);
        const p2CanOccupy = this.canPuyoOccupy(p2x, p2y, true);
        return p1CanOccupy && p2CanOccupy;
    },

    canPuyoOccupy: function (x, y, allowNegativeY = false) {
        if (x < 0 || x >= FIELD_COL || y >= FIELD_ROW) {
            return false;
        }
        if (y < 0) {
            return allowNegativeY;
        }
        return this.field[y][x] === EMPTY_COLOR_ID;
    },

    tryDropPuyoOnce: function () {
        if (!this.currentPuyo || this.gameOver) return false;

        const p1NextY = this.currentPuyo.p1.y + 1;
        const p2NextY = this.currentPuyo.p2.y + 1;

        if (this.isStateValid(this.currentPuyo.p1.x, p1NextY, this.currentPuyo.p2.x, p2NextY)) {
            this.currentPuyo.p1.y = p1NextY;
            this.currentPuyo.p2.y = p2NextY;

            // 高速落下ボーナス
            if (this.isFastDropping) {
                this.score += 1;
                this.scoreLabel.text = 'とくてん ' + this.score;
            }

            this.updatePuyoSprites();
            return true;
        } else {
            this.lockPuyo();
            return false;
        }
    },

    lockPuyo: function () {
        if (!this.currentPuyo) return;

        // フィールドにぷよを配置
        if (this.currentPuyo.p1.y >= 0) {
            this.field[this.currentPuyo.p1.y][this.currentPuyo.p1.x] = this.currentPuyo.p1.color;
        }
        if (this.currentPuyo.p2.y >= 0) {
            this.field[this.currentPuyo.p2.y][this.currentPuyo.p2.x] = this.currentPuyo.p2.color;
        }

        this.currentPuyo = null;
        this.isFastDropping = false;
        this.updateFieldSprites();

        // 連鎖処理を遅延実行
        setTimeout(() => {
            this.processChain();
        }, 100);
    },

    processChain: function () {
        let currentChain = 0;

        const checkAndProcess = () => {
            const erasableGroups = this.findErasableGroups();

            if (erasableGroups.length > 0) {
                currentChain++;
                this.chainCount = currentChain;

                if (currentChain > 1) {
                    this.chainLabel.text = `${currentChain}\n連鎖!!`;
                    if (currentChain > this.maxChainCount) {
                        this.maxChainCount = currentChain;
                    }
                }

                let totalErased = 0;
                let uniqueColors = new Set();

                erasableGroups.forEach(group => {
                    totalErased += group.length;
                    if (group.length > 0 && this.field[group[0].y][group[0].x] !== EMPTY_COLOR_ID) {
                        uniqueColors.add(this.field[group[0].y][group[0].x]);
                    }
                    group.forEach(p => {
                        this.field[p.y][p.x] = EMPTY_COLOR_ID;
                    });
                });

                this.calculateScore(totalErased, currentChain, uniqueColors.size);
                this.updateFieldSprites();

                setTimeout(() => {
                    this.applyGravity();
                    this.updateFieldSprites();
                    setTimeout(checkAndProcess, 300);
                }, 350);
            } else {
                this.chainLabel.text = '';
                this.spawnNewPuyo();
            }
        };

        checkAndProcess();
    },

    findErasableGroups: function () {
        const visited = Array.from({ length: FIELD_ROW }, () => Array(FIELD_COL).fill(false));
        const allErasableGroups = [];

        for (let r = 0; r < FIELD_ROW; r++) {
            for (let c = 0; c < FIELD_COL; c++) {
                if (this.field[r][c] !== EMPTY_COLOR_ID && !visited[r][c]) {
                    const colorToMatch = this.field[r][c];
                    const currentGroup = [];
                    const queue = [{ y: r, x: c }];
                    visited[r][c] = true;
                    currentGroup.push({ y: r, x: c, color: colorToMatch });

                    let head = 0;
                    while (head < queue.length) {
                        const puyo = queue[head++];
                        const neighbors = [
                            { y: puyo.y + 1, x: puyo.x },
                            { y: puyo.y - 1, x: puyo.x },
                            { y: puyo.y, x: puyo.x + 1 },
                            { y: puyo.y, x: puyo.x - 1 },
                        ];

                        for (const n of neighbors) {
                            if (n.y >= 0 && n.y < FIELD_ROW && n.x >= 0 && n.x < FIELD_COL &&
                                !visited[n.y][n.x] && this.field[n.y][n.x] === colorToMatch) {
                                visited[n.y][n.x] = true;
                                currentGroup.push({ y: n.y, x: n.x, color: colorToMatch });
                                queue.push({ y: n.y, x: n.x });
                            }
                        }
                    }

                    if (currentGroup.length >= 4) {
                        allErasableGroups.push(currentGroup);
                    }
                }
            }
        }

        return allErasableGroups;
    },

    applyGravity: function () {
        for (let c = 0; c < FIELD_COL; c++) {
            let emptySlot = FIELD_ROW - 1;
            for (let r = FIELD_ROW - 1; r >= 0; r--) {
                if (this.field[r][c] !== EMPTY_COLOR_ID) {
                    if (r !== emptySlot) {
                        this.field[emptySlot][c] = this.field[r][c];
                        this.field[r][c] = EMPTY_COLOR_ID;
                    }
                    emptySlot--;
                }
            }
        }
    },

    calculateScore: function (erasedCount, chainNumber, numColors) {
        let baseScore = erasedCount * 10;
        const chainBonusMultipliers = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
        let chainBonus = (chainNumber <= 1) ? 0 : (chainBonusMultipliers[chainNumber - 1] || chainBonusMultipliers[chainBonusMultipliers.length - 1]);

        const colorBonusValues = [0, 0, 3, 6, 12, 24];
        let colorBonus = colorBonusValues[numColors] || colorBonusValues[colorBonusValues.length - 1];

        let totalBonus = chainBonus + colorBonus;
        if (totalBonus === 0) totalBonus = 1;

        let scoreThisTurn = baseScore * totalBonus;
        this.score += scoreThisTurn;
        this.scoreLabel.text = 'とくてん ' + this.score;

        // 背景の透明度計算
        let tmpAlpha = this.score / 100000.0;
        if (tmpAlpha >= 1.0) tmpAlpha = 1.0;
        this.bgSprite.alpha = tmpAlpha;

        // スコアに応じて落下速度を調整
        const fallSpeedLevels = [
            { scoreThreshold: 10000, multiplier: 1.0 },
            { scoreThreshold: 30000, multiplier: 0.8 },
            { scoreThreshold: 50000, multiplier: 0.6 },
            { scoreThreshold: 70000, multiplier: 0.4 },
            { scoreThreshold: 80000, multiplier: 1.0 },
            { scoreThreshold: 90000, multiplier: 0.8 },
            { scoreThreshold: 100000, multiplier: 0.6 },
            { scoreThreshold: 110000, multiplier: 0.4 },
            { scoreThreshold: 115000, multiplier: 1.0 },
            { scoreThreshold: 120000, multiplier: 0.8 },
            { scoreThreshold: 125000, multiplier: 0.6 },
        ];
        const currentLevel = fallSpeedLevels.find(level => this.score <= level.scoreThreshold);
        // どの閾値にも当てはまらない場合はデフォルト値(0.4)を使用
        const fallSpeedMultiplier = currentLevel ? currentLevel.multiplier : 0.4;
        this.fallInterval = BASE_FALL_INTERVAL * fallSpeedMultiplier;

        SoundManager.play("hit");
    },

    update: function (app) {

        if (this.gameOver || !this.currentPuyo) return;

        const currentFallInterval = this.isFastDropping ? 50 : this.fallInterval;
        this.fallTimer += app.deltaTime;

        if (this.fallTimer >= currentFallInterval) {
            this.tryDropPuyoOnce();
            this.fallTimer = 0;
        }
    },
});

// アプリケーション起動
phina.main(function () {
    const app = GameApp({
        startLabel: 'init',
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        assets: ASSETS,
        backgroundColor: 'black',
        fps: FPS,

        scenes: [
            {
                label: 'init',
                className: 'InitScene',
                nextLabel: 'title',
            },
            {
                label: 'title',
                className: 'TitleScene',
                nextLabel: 'main',
            },
            {
                label: 'main',
                className: 'MainScene',
                nextLabel: 'title',
            },
        ]
    });

    // iOSなどでユーザー操作がないと音がならない仕様対策
    // 起動後初めて画面をタッチした時に『無音』を鳴らす
    app.domElement.addEventListener('touchend', function dummy() {
        var s = phina.asset.Sound();
        s.loadFromBuffer();
        s.play().stop();
        app.domElement.removeEventListener('touchend', dummy);
    });

    app.run();
});