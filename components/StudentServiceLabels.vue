<script setup lang="ts">
import { BusFront, Coffee, Moon, Timer, Utensils } from '@lucide/vue'
import { serviceDisplayLabel } from '~/shared/catalog'
import type { StudentServiceKey, StudentServices, StudentServiceValues } from '~/types/summer'

const props = withDefaults(defineProps<{
  services: StudentServices
  values?: Partial<StudentServiceValues>
  compact?: boolean
  only?: StudentServiceKey
}>(), {
  values: () => ({}),
  compact: false
})

const isVisible = (key: StudentServiceKey) => props.services[key] && (!props.only || props.only === key)
const hasServices = computed(() => (['breakfast', 'lunch', 'dinner', 'extendedTime', 'transport'] as StudentServiceKey[]).some(isVisible))
const label = (key: StudentServiceKey) => serviceDisplayLabel(key, props.values[key] || '')
</script>

<template>
  <span class="student-service-labels" :class="{ 'student-service-labels--compact': compact }" aria-label="Servicios del alumno">
    <span v-if="isVisible('breakfast')" class="is-breakfast"><Coffee :size="compact ? 11 : 13" />{{ label('breakfast') }}</span>
    <span v-if="isVisible('lunch')" class="is-lunch"><Utensils :size="compact ? 11 : 13" />{{ label('lunch') }}</span>
    <span v-if="isVisible('dinner')" class="is-dinner"><Moon :size="compact ? 11 : 13" />{{ label('dinner') }}</span>
    <span v-if="isVisible('extendedTime')" class="is-extended"><Timer :size="compact ? 11 : 13" />{{ label('extendedTime') }}</span>
    <span v-if="isVisible('transport')" class="is-transport"><BusFront :size="compact ? 11 : 13" />{{ label('transport') }}</span>
    <span v-if="!hasServices && !only" class="is-empty">Sin servicios</span>
  </span>
</template>
