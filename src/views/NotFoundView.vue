<template>
  <main class="not-found">
    <h1>Whoa there, bucko.</h1>
    <p>That page ain't be existin'.</p>
    <RouterLink to="/">Back to the show</RouterLink>
  </main>
</template>

<style scoped>
.not-found {
  min-height: 100dvh;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 8px;
  padding: 24px;
}
h1 {
  margin: 0;
}
p {
  margin: 0 0 12px;
  color: var(--text-muted);
}
</style>
