<template>
    <div class="home-container">
        <div class="hero">
            <h1 class="ink-minimal">
                <span class="ink-char">杀</span>
                <span class="ink-char">破</span>
                <span class="ink-char">狼</span>
            </h1>
            <p class="subtitle">2026 H1 theme</p>
            <p>"Execute, Renovate and Magnetize" &nbsp; “杀心魔，破罗网，狼众生”</p>
            <router-link to="/post/8a877784-76cd-4b0a-a669-4c30cc3a32ec" class="cta-btn">{{ $t('home.viewThemePost')
                }}</router-link>
        </div>
        <div class="fire-wall" aria-hidden="true">
          <div class="glow glow1"></div>
          <div class="glow glow2"></div>
          <div class="glow glow3"></div>
        </div>
      </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
let mainEl = null
onMounted(() => {
  mainEl = document.querySelector('main.main-content')
  if (mainEl) {
    mainEl.__prevOverflowY = mainEl.style.overflowY || ''
    mainEl.style.overflowY = 'hidden'
  }
})
onBeforeUnmount(() => {
  if (mainEl) {
    mainEl.style.overflowY = mainEl.__prevOverflowY || ''
    delete mainEl.__prevOverflowY
  }
})
</script>

<style scoped>
.main-content {
    overflow: hidden !important;
}
.home-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 100px 20px;
    color: #fff;
    text-align: center;
}



.hero p {
    font-size: 1.2rem;
    color: #888;
    margin-bottom: 40px;
}

.hero p.subtitle {
    font-size: 1.1rem;
    color: #666;
    margin-bottom: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5em;
}

.cta-btn {
    display: inline-block;
    background: var(--component-bg-blur-alt);
    border: 1px solid var(--border-color-blur);
    backdrop-filter: blur(10px);
    color: var(--component-text-primary);
    padding: 10px 24px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 1.1rem;
    transition: all 0.3s ease;
}

.cta-btn:hover {
  filter: brightness(1.5);
  transform: scale(1.05);
}

.ink-minimal {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-bottom: 2rem;
}

.ink-char {
  font-size: 8rem;
  font-weight: 900;
  font-family: 'Noto Serif SC', 'Ma Shan Zheng', serif; /* 毛笔字体 */
  background: radial-gradient(circle at 30% 40%, 
    #d9d9d9,  /* 深灰接近墨色 */
    #959595,
    #6a6a6a
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.02em;
  line-height: 1;
  position: relative;
  transition: all 0.3s ease;
}

/* 增加墨迹飞白纹理（极细微） */
.ink-char::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" opacity="0.1"><path d="M20,30 Q40,20 60,30 Q80,40 70,60 Q60,80 40,70 Q20,60 30,40" fill="none" stroke="%23000" stroke-width="2"/></svg>');
  background-size: cover;
  pointer-events: none;
  mix-blend-mode: multiply;
}

/* 单个字微调，更自然 */
.ink-char:nth-child(2) { transform: translateY(10px); }
.ink-char:nth-child(3) { transform: translateY(-5px); }
.ink-char:nth-child(4) { transform: translateY(8px); }

.minimal-sub {
  font-size: 1rem;
  letter-spacing: 0.5em;
  text-transform: uppercase;
  color: #666;
  font-weight: 300;
  border-top: 1px solid #eaeaea;
  display: inline-block;
  padding-top: 1.5rem;
}

/* 火光投射到墙上的效果（大范围模糊光晕，非明火） */
.home-container {
  position: relative;
  z-index: 2;
}
.hero {
  position: relative;
  z-index: 3;
}
.fire-wall {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -40vh;
  height: 60vh;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}
.glow {
  position: absolute;
  bottom: 8vh;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.6;
  mix-blend-mode: screen;
}
.glow1 {
  width: 120vw;
  height: 40vh;
  background: radial-gradient(ellipse at 50% 80%, rgba(255,180,60,0.95) 0%, rgba(255,120,30,0.7) 35%, rgba(200,40,20,0.45) 60%, transparent 80%);
  animation: glow-flicker 4s infinite ease-in-out;
}
.glow2 {
  width: 90vw;
  height: 30vh;
  background: radial-gradient(ellipse at 45% 75%, rgba(255,220,140,0.7) 0%, rgba(255,140,60,0.35) 50%, transparent 75%);
  left: 40%;
  bottom: 6vh;
  filter: blur(48px);
  animation: glow-flicker 3.2s infinite ease-in-out;
  animation-delay: 0.6s;
}
.glow3 {
  width: 70vw;
  height: 22vh;
  background: radial-gradient(ellipse at 60% 70%, rgba(255,240,200,0.6) 0%, rgba(255,160,80,0.28) 50%, transparent 75%);
  left: 60%;
  bottom: 4vh;
  filter: blur(36px);
  animation: glow-flicker 5s infinite ease-in-out;
  animation-delay: 1.1s;
}

@keyframes glow-flicker {
  0% { transform: translateX(-50%) scale(1); opacity: 0.55; filter: blur(60px); }
  20% { transform: translateX(-48%) scale(1.03); opacity: 0.72; filter: blur(55px); }
  40% { transform: translateX(-52%) scale(0.98); opacity: 0.48; filter: blur(62px); }
  60% { transform: translateX(-49%) scale(1.06); opacity: 0.8; filter: blur(50px); }
  80% { transform: translateX(-51%) scale(0.97); opacity: 0.5; filter: blur(65px); }
  100% { transform: translateX(-50%) scale(1); opacity: 0.6; filter: blur(60px); }
}
</style>