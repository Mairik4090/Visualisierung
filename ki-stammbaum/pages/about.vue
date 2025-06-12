<template>
  <div class="about-page">
    <h1>Über dieses Projekt</h1>
    <p>
      Der KI-Stammbaum visualisiert die Entwicklung der künstlichen Intelligenz.
      Die Daten stammen aus einer kuratierten Sammlung historischer Konzepte
      und Technologien.
    </p>
    <h2>Credits</h2>
    <p>
      Diese Demo wurde im Rahmen eines Beispielprojekts erstellt. Die
      Visualisierung basiert auf Nuxt 3 und D3.js.
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<style scoped>
.about-page h1 {
  margin-bottom: 1rem;
}
</style>
