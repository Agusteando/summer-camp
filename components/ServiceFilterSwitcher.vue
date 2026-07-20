<script setup lang="ts">
import { Coffee, Moon, Timer, Utensils } from '@lucide/vue'
import type { ServiceView, StudentServiceKey, SummerStudent } from '~/types/summer'

const props = defineProps<{
  students: SummerStudent[]
  modelValue: ServiceView
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ServiceView]
}>()

const counts = computed<Record<StudentServiceKey, number>>(() => ({
  breakfast: props.students.filter((student) => student.services.breakfast).length,
  lunch: props.students.filter((student) => student.services.lunch).length,
  dinner: props.students.filter((student) => student.services.dinner).length,
  extendedTime: props.students.filter((student) => student.services.extendedTime).length
}))
</script>

<template>
  <div class="service-filter-switcher" aria-label="Filtrar por servicio">
    <span class="service-filter-switcher__label">Servicio</span>
    <div class="service-filter-switcher__track">
      <button
        type="button"
        class="service-filter-switcher__option"
        :class="{ 'is-active': modelValue === 'all' }"
        :aria-pressed="modelValue === 'all'"
        @click="emit('update:modelValue', 'all')"
      >Todos <b>{{ students.length }}</b></button>
      <button
        v-if="counts.breakfast"
        type="button"
        class="service-filter-switcher__option service-filter-switcher__option--breakfast"
        :class="{ 'is-active': modelValue === 'breakfast' }"
        :aria-pressed="modelValue === 'breakfast'"
        @click="emit('update:modelValue', 'breakfast')"
      ><Coffee :size="13" />Desayuno <b>{{ counts.breakfast }}</b></button>
      <button
        v-if="counts.lunch"
        type="button"
        class="service-filter-switcher__option service-filter-switcher__option--lunch"
        :class="{ 'is-active': modelValue === 'lunch' }"
        :aria-pressed="modelValue === 'lunch'"
        @click="emit('update:modelValue', 'lunch')"
      ><Utensils :size="13" />Comida <b>{{ counts.lunch }}</b></button>
      <button
        v-if="counts.dinner"
        type="button"
        class="service-filter-switcher__option service-filter-switcher__option--dinner"
        :class="{ 'is-active': modelValue === 'dinner' }"
        :aria-pressed="modelValue === 'dinner'"
        @click="emit('update:modelValue', 'dinner')"
      ><Moon :size="13" />Cena <b>{{ counts.dinner }}</b></button>
      <button
        v-if="counts.extendedTime"
        type="button"
        class="service-filter-switcher__option service-filter-switcher__option--extra"
        :class="{ 'is-active': modelValue === 'extendedTime' }"
        :aria-pressed="modelValue === 'extendedTime'"
        @click="emit('update:modelValue', 'extendedTime')"
      ><Timer :size="13" />Extra <b>{{ counts.extendedTime }}</b></button>
    </div>
  </div>
</template>
