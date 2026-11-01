class RiftScene extends Phaser.Scene {
  constructor() {
    super('rift');
    this.ready = false;
    this.enemyTimer = null;
    this.telegraphTimer = null;
  }

  init(data) {
    this.avatar = data.avatar;
    this.role = data.avatar.role;
    this.enemy = data.enemy || { name: 'Riftling', icon: '◉', hp: 55, maxHp: 55 };
    this.enemyHp = this.enemy.hp;
    this.playerHp = this.avatar.hp;
    this.ready = true;
  }

  create() {
    const w = 800;
    const h = 450;

    this.cameras.main.setBackgroundColor('#0b1022');

    // Background Cyber Grid
    const g = this.add.graphics();
    g.fillGradientStyle(0x131d3d, 0x131d3d, 0x070c1a, 0x070c1a, 1);
    g.fillRect(0, 0, w, h);
    g.lineStyle(1, 0x273b6b, 0.22);
    for (let x = 0; x < w; x += 40) g.lineBetween(x, 0, x, h);
    for (let y = 0; y < h; y += 40) g.lineBetween(0, y, w, y);

    // Floating Starlight Particles
    for (let i = 0; i < 24; i++) {
      const s = this.add.circle(
        Phaser.Math.Between(10, w - 10),
        Phaser.Math.Between(10, h - 10),
        Phaser.Math.Between(1, 2.5),
        0xaab9ff,
        0.5
      );
      this.tweens.add({
        targets: s,
        alpha: 0.1,
        y: s.y - 12,
        duration: Phaser.Math.Between(1000, 2400),
        yoyo: true,
        repeat: -1
      });
    }

    // Ground Shadows & Rift Portal
    this.add.ellipse(w * 0.28, h * 0.76, 170, 32, 0x03060f, 0.6);
    this.add.ellipse(w * 0.72, h * 0.76, 170, 32, 0x03060f, 0.6);

    const riftPortal = this.add.circle(w * 0.72, h * 0.52, 60, 0x45d4cd, 0.12)
      .setStrokeStyle(3, 0x67ede0, 0.5);
    this.tweens.add({
      targets: riftPortal,
      scale: 1.25,
      alpha: 0.25,
      duration: 1300,
      yoyo: true,
      repeat: -1
    });

    // Player Hero Container
    this.player = this.add.container(w * 0.28, h * 0.56);
    this.drawHero();

    // Enemy Sprite Container
    this.enemySprite = this.add.container(w * 0.72, h * 0.56);
    this.drawEnemy();

    // Physics
    this.physics.world.setBounds(20, 40, w - 40, h - 90);
    this.physics.add.existing(this.player);
    this.player.body.setCircle(28, -28, -28)
      .setCollideWorldBounds(true)
      .setMaxVelocity(200);

    // Keyboard Controls
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E');
    this.input.keyboard.on('keydown-SPACE', () => this.triggerAction('attack'));
    this.input.keyboard.on('keydown-E', () => this.triggerAction('skill'));

    // Canvas click to attack
    this.input.on('pointerdown', p => {
      if (p.y < h - 40) this.triggerAction('attack');
    });

    // Top HUD
    this.hudPlayerName = this.add.text(w * 0.28, 22, `${this.avatar.icon} ${this.avatar.name}`, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5, 0);

    this.hudEnemyName = this.add.text(w * 0.72, 22, `${this.enemy.icon} ${this.enemy.name}`, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ff9fb4'
    }).setOrigin(0.5, 0);

    // Health Bar Containers
    this.hpBarBgPlayer = this.add.rectangle(w * 0.28, 48, 180, 10, 0x1a233d).setStrokeStyle(1, 0x3d4e78);
    this.hpBarFillPlayer = this.add.rectangle(w * 0.28 - 89, 48, 178, 8, 0x45d4cd).setOrigin(0, 0.5);

    this.hpBarBgEnemy = this.add.rectangle(w * 0.72, 48, 180, 10, 0x1a233d).setStrokeStyle(1, 0x3d4e78);
    this.hpBarFillEnemy = this.add.rectangle(w * 0.72 - 89, 48, 178, 8, 0xff5470).setOrigin(0, 0.5);

    // Telegraph status indicator
    this.telegraphText = this.add.text(w * 0.72, h * 0.32, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ff5470',
      backgroundColor: '#1b0914cc',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setAlpha(0);

    // Bottom Help Text
    this.add.text(w / 2, h - 14, 'WASD/Panah gerak · Spasi Serang · E Skill · Tombol aksi di bawah arena', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px',
      color: '#8b9abf'
    }).setOrigin(0.5, 1);

    this.updateHud();
    this.startTelegraphCycle();
  }

  drawHero() {
    const g = this.add.graphics();
    let heroColor = 0x8f7cff;
    try {
      heroColor = Phaser.Display.Color.HexStringToColor(this.avatar.color || '#8f7cff').color;
    } catch {}

    // Shadow
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, 30, 60, 20);

    // Body Armor
    g.fillStyle(heroColor, 1);
    g.fillRoundedRect(-24, -30, 48, 54, 16);

    // Visor / Face
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(-8, -8, 4);
    g.fillCircle(8, -8, 4);

    // Aura ring
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeRoundedRect(-28, -34, 56, 62, 18);

    // Crest
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0, -35, 7);

    this.player.add(g);
  }

  drawEnemy() {
    const g = this.add.graphics();

    // Shadow
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, 32, 76, 22);

    // Core
    g.fillStyle(0xd8456a, 1);
    g.fillCircle(0, 0, 36);

    // Horns / Spikes
    g.fillStyle(0x521f38, 1);
    g.fillTriangle(-26, -20, -6, -50, 0, -18);
    g.fillTriangle(26, -20, 6, -50, 0, -18);

    // Eyes
    g.fillStyle(0xffea9f, 1);
    g.fillCircle(-11, -4, 5);
    g.fillCircle(11, -4, 5);

    // Mouth / Visor
    g.fillStyle(0x361021, 1);
    g.fillRoundedRect(-12, 11, 24, 6, 3);

    // Pulsing shield
    g.lineStyle(2, 0xff7b9a, 0.7);
    g.strokeCircle(0, 0, 42);

    this.enemySprite.add(g);
  }

  update() {
    if (!this.player?.body) return;
    let vx = 0;
    let vy = 0;

    if (this.keys.A.isDown || this.keys.LEFT.isDown) vx = -1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) vx = 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) vy = -1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) vy = 1;

    this.player.body.setVelocity(vx * 190, vy * 190);
    if (vx || vy) {
      this.player.rotation = Phaser.Math.Angle.RotateTo(
        this.player.rotation,
        Math.atan2(vy, vx) + Math.PI / 2,
        0.14
      );
    }
  }

  updateHud() {
    if (!this.hpBarFillPlayer || !this.hpBarFillEnemy) return;

    // Player HP Bar (178px max)
    const playerPct = Math.max(0, Math.min(1, this.playerHp / (this.avatar.maxHp || 100)));
    this.hpBarFillPlayer.width = Math.max(2, 178 * playerPct);

    // Enemy HP Bar
    const enemyMax = this.enemy.maxHp || 55;
    const enemyPct = Math.max(0, Math.min(1, this.enemyHp / enemyMax));
    this.hpBarFillEnemy.width = Math.max(2, 178 * enemyPct);

    // Colors according to HP
    if (playerPct < 0.3) this.hpBarFillPlayer.fillColor = 0xff5470;
    else this.hpBarFillPlayer.fillColor = 0x45d4cd;
  }

  startTelegraphCycle() {
    if (this.enemyHp <= 0) return;

    // Clean previous timers
    if (this.telegraphTimer) this.telegraphTimer.remove();
    if (this.enemyTimer) this.enemyTimer.remove();

    // 1.8s telegraph notice
    this.telegraphTimer = this.time.delayedCall(1600, () => {
      if (this.enemyHp <= 0) return;
      this.telegraphText.setText('⚠️ MUSUH AKAN MENYERANG! TEKAN DODGE').setAlpha(1);
      this.tweens.add({
        targets: this.enemySprite,
        scale: 1.14,
        duration: 250,
        yoyo: true,
        repeat: 2
      });
    });

    // Reset indicator
    this.enemyTimer = this.time.delayedCall(2800, () => {
      if (this.enemyHp <= 0) return;
      this.telegraphText.setAlpha(0);
      this.startTelegraphCycle();
    });
  }

  triggerAction(action) {
    if (window.onCombatActionTrigger) {
      window.onCombatActionTrigger(action);
    }
  }

  sync(result) {
    if (!result) return;
    this.enemyHp = result.encounter?.hp ?? this.enemyHp;
    this.playerHp = result.playerHp ?? this.playerHp;
    this.updateHud();

    if (result.enemyHit) {
      this.hit(this.player, 'Terkena Serangan Musuh!');
    }

    if (result.encounter?.status === 'won') {
      this.enemyHp = 0;
      if (this.telegraphTimer) this.telegraphTimer.remove();
      if (this.enemyTimer) this.enemyTimer.remove();
      this.telegraphText.setAlpha(0);

      this.tweens.add({
        targets: this.enemySprite,
        alpha: 0,
        scale: 0.1,
        duration: 500
      });
      this.pop('✦ RIFT DITUTUP! MENANG! ✦', 400, 200, '#45d4cd');
    }
  }

  hit(target, msg) {
    this.cameras.main.shake(100, 0.004);
    this.tweens.add({
      targets: target,
      alpha: 0.2,
      duration: 70,
      yoyo: true,
      repeat: 2
    });
    this.pop(msg, target.x, target.y - 45, '#ff5470');
  }

  pop(text, x, y, color) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color,
      stroke: '#070b18',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 900,
      onComplete: () => t.destroy()
    });
  }
}

let activeGame = null;

window.RiftboundGame = {
  mount(avatar, encounter = {}) {
    this.unmount();

    const enemy = {
      name: encounter.name || 'Riftling',
      icon: encounter.icon || '◉',
      hp: encounter.hp || 55,
      maxHp: encounter.maxHp || 55
    };

    activeGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-root',
      width: 800,
      height: 450,
      backgroundColor: '#0b1022',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: 'arcade'
      },
      scene: [RiftScene]
    });

    activeGame.scene.start('rift', { avatar, enemy });
  },

  sync(result) {
    const scene = activeGame?.scene?.getScene('rift');
    scene?.sync(result);
  },

  unmount() {
    if (activeGame) {
      activeGame.destroy(true, false);
      activeGame = null;
    }
  }
};
