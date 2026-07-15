<script setup lang="ts">
const props = defineProps<{ matricula: string; name: string; available?: boolean; token?: string | null }>()
const root = ref<HTMLElement | null>(null)
const visible = ref(false)
const failed = ref(false)
const initials = computed(() => props.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase())
const photoUrl = computed(() => `/api/summer/photo/${encodeURIComponent(props.matricula)}?token=${encodeURIComponent(props.token || '')}`)

onMounted(() => {
  if (!props.available || !props.token) return
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      visible.value = true
      observer.disconnect()
    }
  }, { rootMargin: '180px' })
  if (root.value) observer.observe(root.value)
  onBeforeUnmount(() => observer.disconnect())
})
</script>

<template>
  <div ref="root" class="student-photo">
    <img v-if="visible && !failed" :src="photoUrl" :alt="name" loading="lazy" decoding="async" @error="failed = true">
    <span v-else>{{ initials }}</span>
  </div>
</template>
