<script setup lang="ts">
import { Coffee, Moon, Timer, Utensils } from '@lucide/vue'
import type { StudentServices } from '~/types/summer'

const props = withDefaults(defineProps<{
  services: StudentServices
  compact?: boolean
}>(), {
  compact: false
})

const hasServices = computed(() => Object.values(props.services).some(Boolean))
</script>

<template>
  <span class="student-service-labels" :class="{ 'student-service-labels--compact': compact }" aria-label="Servicios del alumno">
    <span v-if="services.breakfast" class="is-breakfast"><Coffee :size="compact ? 11 : 13" />Desayuno</span>
    <span v-if="services.lunch" class="is-lunch"><Utensils :size="compact ? 11 : 13" />Comida</span>
    <span v-if="services.dinner" class="is-dinner"><Moon :size="compact ? 11 : 13" />Cena</span>
    <span v-if="services.extendedTime" class="is-extra"><Timer :size="compact ? 11 : 13" />Extra</span>
    <span v-if="!hasServices" class="is-empty">Sin servicios</span>
  </span>
</template>
