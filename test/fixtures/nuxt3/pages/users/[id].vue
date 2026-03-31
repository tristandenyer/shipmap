<template>
  <div>User {{ $route.params.id }}</div>
</template>
<script setup>
definePageMeta({ ssr: false });
</script>
