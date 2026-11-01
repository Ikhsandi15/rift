class RiftScene extends Phaser.Scene {
  constructor() {
    super('rift');
    this.ready = false;
    this.enemyTimer = null;
    this.telegraphTimer = null;
  }

  init(data) {
    this.avatar = data.avatar;
    this.role = (data.avatar.role || 'vanguard').toLowerCase();
    this.enemy = data.enemy || { name: 'Riftling', icon: '◉', hp: 55, maxHp: 55 };
    this.enemyHp = this.enemy.hp;
    this.playerHp = this.avatar.hp;
    this.originPlayerX = 800 * 0.28;
    this.originPlayerY = 450 * 0.56;
    this.originEnemyX = 800 * 0.72;
    this.originEnemyY = 450 * 0.56;
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
    this.add.ellipse(this.originPlayerX, h * 0.76, 170, 32, 0x03060f, 0.6);
    this.add.ellipse(this.originEnemyX, h * 0.76, 170, 32, 0x03060f, 0.6);

    const riftPortal = this.add.circle(this.originEnemyX, h * 0.52, 62, 0x45d4cd, 0.12)
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
    this.player = this.add.container(this.originPlayerX, this.originPlayerY);
    this.drawHero();

    // Enemy Sprite Container
    this.enemySprite = this.add.container(this.originEnemyX, this.originEnemyY);
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
    this.hudPlayerName = this.add.text(this.originPlayerX, 22, `${this.avatar.icon} ${this.avatar.name}`, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5, 0);

    this.hudEnemyName = this.add.text(this.originEnemyX, 22, `${this.enemy.icon} ${this.enemy.name}`, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ff9fb4'
    }).setOrigin(0.5, 0);

    // Health Bar Containers
    this.hpBarBgPlayer = this.add.rectangle(this.originPlayerX, 48, 180, 10, 0x1a233d).setStrokeStyle(1, 0x3d4e78);
    this.hpBarFillPlayer = this.add.rectangle(this.originPlayerX - 89, 48, 178, 8, 0x45d4cd).setOrigin(0, 0.5);

    this.hpBarBgEnemy = this.add.rectangle(this.originEnemyX, 48, 180, 10, 0x1a233d).setStrokeStyle(1, 0x3d4e78);
    this.hpBarFillEnemy = this.add.rectangle(this.originEnemyX - 89, 48, 178, 8, 0xff5470).setOrigin(0, 0.5);

    // Telegraph status indicator
    this.telegraphText = this.add.text(this.originEnemyX, h * 0.30, '', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ff5470',
      backgroundColor: '#1b0914ee',
      padding: { x: 10, y: 6 }
    }).setOrigin(0.5).setAlpha(0);

    // Bottom Help Text
    this.add.text(w / 2, h - 14, 'WASD/Panah gerak · Spasi Serang · E Skill Role · Tombol aksi sentuh di bawah', {
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

    // Mouth
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

    const playerPct = Math.max(0, Math.min(1, this.playerHp / (this.avatar.maxHp || 100)));
    this.hpBarFillPlayer.width = Math.max(2, 178 * playerPct);

    const enemyMax = this.enemy.maxHp || 55;
    const enemyPct = Math.max(0, Math.min(1, this.enemyHp / enemyMax));
    this.hpBarFillEnemy.width = Math.max(2, 178 * enemyPct);

    if (playerPct < 0.3) this.hpBarFillPlayer.fillColor = 0xff5470;
    else this.hpBarFillPlayer.fillColor = 0x45d4cd;
  }

  startTelegraphCycle() {
    if (this.enemyHp <= 0) return;

    if (this.telegraphTimer) this.telegraphTimer.remove();
    if (this.enemyTimer) this.enemyTimer.remove();

    this.telegraphTimer = this.time.delayedCall(1600, () => {
      if (this.enemyHp <= 0) return;
      this.telegraphText.setText('⚠️ MUSUH SIAP MENYERANG! TEKAN HINDAR (DODGE)').setAlpha(1);
      this.tweens.add({
        targets: this.enemySprite,
        scale: 1.15,
        duration: 250,
        yoyo: true,
        repeat: 2
      });
    });

    this.enemyTimer = this.time.delayedCall(2800, () => {
      if (this.enemyHp <= 0) return;
      this.telegraphText.setAlpha(0);
      this.startTelegraphCycle();
    });
  }

  triggerAction(action) {
    if (action === 'skill') {
      this.playRoleSkillAnimation();
    } else if (action === 'attack') {
      this.playAttackAnimation();
    } else if (action === 'dodge') {
      this.playDodgeAnimation();
    }

    if (window.onCombatActionTrigger) {
      window.onCombatActionTrigger(action);
    }
  }

  playAttackAnimation() {
    // Quick hero dash forward
    this.tweens.add({
      targets: this.player,
      x: this.originPlayerX + 60,
      duration: 100,
      yoyo: true
    });

    // Slash graphic on enemy
    const slash = this.add.graphics();
    slash.lineStyle(4, 0xffffff, 1);
    slash.beginPath();
    slash.moveTo(this.originEnemyX - 35, this.originEnemyY - 35);
    slash.lineTo(this.originEnemyX + 35, this.originEnemyY + 35);
    slash.strokePath();

    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 220,
      onComplete: () => slash.destroy()
    });
  }

  playDodgeAnimation() {
    // Backstep & ghost fade
    this.tweens.add({
      targets: this.player,
      x: this.originPlayerX - 45,
      alpha: 0.35,
      duration: 120,
      yoyo: true,
      onComplete: () => this.player.setAlpha(1)
    });
    this.pop('🛡️ DODGE!', this.player.x, this.player.y - 45, '#a9d4ff');
  }

  playRoleSkillAnimation() {
    const role = this.role;

    if (role === 'vanguard') {
      // COMET BREAK (Meteor Dash & Ground Shockwave)
      this.cameras.main.shake(180, 0.009);
      this.tweens.add({
        targets: this.player,
        x: this.originEnemyX - 40,
        duration: 140,
        yoyo: true
      });

      // Fire burst circle
      const burst = this.add.circle(this.originEnemyX, this.originEnemyY, 20, 0xff5533, 0.85);
      this.tweens.add({
        targets: burst,
        scale: 4,
        alpha: 0,
        duration: 450,
        onComplete: () => burst.destroy()
      });
      this.pop('🔥 COMET BREAK!', this.originEnemyX, this.originEnemyY - 55, '#ff6b55');

    } else if (role === 'tideweaver') {
      // MOONWELL (Water Vortex & Healing Aura)
      const ring = this.add.circle(this.player.x, this.player.y, 15, 0x45d4cd, 0.7)
        .setStrokeStyle(4, 0x7cfbf4, 0.9);
      this.tweens.add({
        targets: ring,
        scale: 4.5,
        alpha: 0,
        duration: 600,
        onComplete: () => ring.destroy()
      });

      // Tidal splash towards enemy
      const wave = this.add.ellipse(this.originPlayerX + 80, this.originPlayerY, 40, 70, 0x55c9ef, 0.8);
      this.tweens.add({
        targets: wave,
        x: this.originEnemyX,
        alpha: 0,
        duration: 350,
        onComplete: () => wave.destroy()
      });
      this.pop('🌊 MOONWELL (+HP REGEN)', this.player.x, this.player.y - 50, '#55c9ef');

    } else if (role === 'mosswarden') {
      // ROOT BASTION (Emerald Shield & Bramble Thorns)
      const shield = this.add.circle(this.player.x, this.player.y, 45, 0x22c55e, 0.3)
        .setStrokeStyle(5, 0x86efac, 0.95);
      this.tweens.add({
        targets: shield,
        scale: 1.3,
        alpha: 0,
        duration: 700,
        onComplete: () => shield.destroy()
      });

      // Ground thorns under enemy
      const thorns = this.add.graphics();
      thorns.lineStyle(4, 0x4ade80, 1);
      thorns.beginPath();
      thorns.moveTo(this.originEnemyX - 30, this.originEnemyY + 25);
      thorns.lineTo(this.originEnemyX, this.originEnemyY - 20);
      thorns.lineTo(this.originEnemyX + 30, this.originEnemyY + 25);
      thorns.strokePath();
      this.tweens.add({
        targets: thorns,
        alpha: 0,
        duration: 500,
        onComplete: () => thorns.destroy()
      });
      this.pop('🌿 ROOT BASTION!', this.player.x, this.player.y - 50, '#83d68a');

    } else if (role === 'arcanist') {
      // PRISM LANCE (Crystal Laser Beam)
      this.cameras.main.shake(120, 0.005);
      const beam = this.add.graphics();
      beam.lineStyle(6, 0xd8b4fe, 1);
      beam.beginPath();
      beam.moveTo(this.player.x + 20, this.player.y);
      beam.lineTo(this.originEnemyX, this.originEnemyY);
      beam.strokePath();

      this.tweens.add({
        targets: beam,
        alpha: 0,
        duration: 350,
        onComplete: () => beam.destroy()
      });
      this.pop('✦ PRISM LANCE!', this.originEnemyX, this.originEnemyY - 55, '#b38aff');

    } else if (role === 'gearling') {
      // CLOCKWORK SWARM (Spinning Golden Gears)
      for (let i = 0; i < 4; i++) {
        const gear = this.add.text(this.player.x, this.player.y + (i * 12 - 18), '⚙️', {
          fontSize: '22px'
        }).setOrigin(0.5);

        this.tweens.add({
          targets: gear,
          x: this.originEnemyX + Phaser.Math.Between(-25, 25),
          y: this.originEnemyY + Phaser.Math.Between(-25, 25),
          angle: 360,
          duration: 250 + (i * 60),
          onComplete: () => gear.destroy()
        });
      }
      this.pop('⚙️ CLOCKWORK SWARM!', this.originEnemyX, this.originEnemyY - 55, '#f6bd55');

    } else if (role === 'wisp_scout') {
      // AFTERIMAGE DASH (Gale Phantom Strike)
      // Phantom clones
      [-20, 20].forEach(offset => {
        const shadow = this.add.circle(this.player.x + offset, this.player.y, 22, 0xa9d4ff, 0.45);
        this.tweens.add({
          targets: shadow,
          alpha: 0,
          duration: 300,
          onComplete: () => shadow.destroy()
        });
      });

      this.tweens.add({
        targets: this.player,
        x: this.originEnemyX - 50,
        duration: 100,
        yoyo: true
      });
      this.pop('🪽 AFTERIMAGE DASH!', this.player.x, this.player.y - 50, '#a9d4ff');
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
