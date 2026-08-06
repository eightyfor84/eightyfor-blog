<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="home-container">
    <div class="hero-section">
      <div class="logos">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" class="logo" alt="Vite logo" />
        </a>
        <a href="https://vuejs.org/" target="_blank">
          <img src="/src/assets/vue.svg" class="logo vue" alt="Vue logo" />
        </a>
      </div>
      <h1>欢迎使用 Chronicle</h1>
      <p class="hero-description">
        一个xx的平台
      </p>
    </div>

    <div class="features-section">
      <div class="feature-card">
        <h3>智能文本编辑器</h3>
        <p>支持多种编程语言的语法高亮和智能缩进</p>
        <div class="card">
          <button type="button" @click="count++">演示计数器: {{ count }}</button>
        </div>
      </div>
      
      <div class="feature-card">
        <h3>实时预览</h3>
        <p>即时查看代码效果，支持多种文件格式</p>
      </div>
      
      <div class="feature-card">
        <h3>项目管理</h3>
        <p>轻松管理您的代码项目和文档</p>
      </div>
    </div>

    <div class="quick-start">
      <h2>快速开始</h2>
      <p>
        点击上方导航栏中的 
        <router-link to="/editor" class="editor-link">文本编辑器</router-link> 
        开始使用我们的智能编辑器
      </p>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  color: #d4d4d4;
}

.hero-section {
  text-align: center;
  margin-bottom: 4rem;
}

.logos {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

.hero-section h1 {
  font-size: 3rem;
  margin: 1rem 0;
  color: #ffffff;
}

.hero-description {
  font-size: 1.2rem;
  color: #b8b8b8;
  margin-bottom: 2rem;
}

.features-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.feature-card {
  background: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
}

.feature-card h3 {
  color: #ffffff;
  margin-bottom: 1rem;
}

.feature-card p {
  color: #b8b8b8;
  line-height: 1.6;
}

.quick-start {
  text-align: center;
  background: #1a1a1a;
  padding: 3rem;
  border-radius: 8px;
  border: 1px solid #3e3e42;
}

.quick-start h2 {
  color: #ffffff;
  margin-bottom: 1rem;
}

.editor-link {
  color: #007acc;
  font-weight: bold;
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.editor-link:hover {
  background-color: rgba(0, 122, 204, 0.1);
}

.card {
  margin-top: 1rem;
}

.card button {
  background: #007acc;
  color: white;
  border: none;
}

.card button:hover {
  background: #1177bb;
  border-color: transparent;
}
</style>
