<template>
  <div>
    <header class="site-header">
      <nav>
        <NuxtLink v-for="route in menuRoutes" :key="route.path" :to="route.path">
          {{ route.name }}
        </NuxtLink>
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
import { computed } from 'vue';
import { useRouter } from '#imports';

const router = useRouter();
const menuRoutes = computed(() =>
  router.getRoutes().filter((r) => r.name && !r.path.includes(':'))
);
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

