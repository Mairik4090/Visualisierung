<template>
  <div>
    <header class="site-header">
      <nav>
        <NuxtLink to="/">Start</NuxtLink>
        |
        <NuxtLink to="/stammbaum">Stammbaum</NuxtLink>
        |
        <NuxtLink to="/about">Über</NuxtLink>
      </nav>
    </header>
    <main>
      <slot />
    </main>
    <footer class="site-footer">
      <p>&copy; 2024 KI-Stammbaum</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Grundlayout für alle Seiten
</script>

<style scoped>
.site-header {
  padding: 1rem;
  background-color: #f5f5f5;
}
.site-header nav a {
  margin-right: 0.5rem;
}
.site-footer {
  padding: 1rem;
  background-color: #f5f5f5;
  text-align: center;
}
main {
  padding: 1rem;
}
</style>
