<script setup lang="ts">
import { AGE_GROUPS, ageGroupViewKeyFor } from '~/shared/catalog'
import type { AgeGroupView, SummerStudent } from '~/types/summer'

const props = defineProps<{
  students: SummerStudent[]
  modelValue: AgeGroupView
}>()

const emit = defineEmits<{
  'update:modelValue': [group: AgeGroupView]
}>()

const options = computed(() => {
  const counts = new Map<AgeGroupView, number>()
  props.students.forEach((student) => {
    const key = ageGroupViewKeyFor(student.ageGroup)
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  const groups: Array<{ key: AgeGroupView; label: string; count: number }> = [
    { key: 'all', label: 'Todos', count: props.students.length }
  ]

  AGE_GROUPS.forEach((group) => {
    const count = counts.get(group.key) || 0
    if (count) groups.push({ key: group.key, label: group.label, count })
  })

  const other = counts.get('other') || 0
  if (other) groups.push({ key: 'other', label: 'Sin grupo', count: other })
  return groups
})
</script>

<template>
  <nav class="age-group-switcher" aria-label="Grupo de edad">
    <span class="age-group-switcher__label">Edades</span>
    <div class="age-group-switcher__track" role="tablist" aria-label="Cambiar grupo de edad">
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        role="tab"
        class="age-group-switcher__option"
        :class="{ 'is-active': modelValue === option.key }"
        :aria-selected="modelValue === option.key"
        @click="emit('update:modelValue', option.key)"
      >
        <span>{{ option.label }}</span>
        <b>{{ option.count }}</b>
      </button>
    </div>
  </nav>
</template>
