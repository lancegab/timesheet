<template>
  <div></div>
</template>

<script setup lang="ts">
const auth = useAuth()
if (auth.isAdmin.value) {
  navigateTo('/admin')
} else {
  navigateTo('/timesheet')
}
</script>
