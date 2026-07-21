<script setup lang="ts">
import { BusFront, ClipboardCheck, Coffee, Moon, Timer, Utensils } from '@lucide/vue'
import type { AttendanceType, StudentServiceKey, SummerStudent } from '~/types/summer'

const props = defineProps<{
  students: SummerStudent[]
  modelValue: AttendanceType
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AttendanceType]
}>()

const counts = computed<Record<StudentServiceKey, number>>(() => ({
  breakfast: props.students.filter((student) => student.services.breakfast).length,
  lunch: props.students.filter((student) => student.services.lunch).length,
  dinner: props.students.filter((student) => student.services.dinner).length,
  extendedTime: props.students.filter((student) => student.services.extendedTime).length,
  transport: props.students.filter((student) => student.services.transport).length
}))
</script>

<template>
  <div class="attendance-type-switcher" aria-label="Tipo de asistencia">
    <span class="attendance-type-switcher__label">Pase</span>
    <div class="attendance-type-switcher__track">
      <button
        type="button"
        class="attendance-type-switcher__option attendance-type-switcher__option--general"
        :class="{ 'is-active': modelValue === 'general' }"
        :aria-pressed="modelValue === 'general'"
        @click="emit('update:modelValue', 'general')"
      ><span><ClipboardCheck :size="17" /></span><strong>General</strong><b>{{ students.length }}</b></button>
      <button
        v-if="counts.breakfast"
        type="button"
        class="attendance-type-switcher__option attendance-type-switcher__option--breakfast"
        :class="{ 'is-active': modelValue === 'breakfast' }"
        :aria-pressed="modelValue === 'breakfast'"
        @click="emit('update:modelValue', 'breakfast')"
      ><span><Coffee :size="17" /></span><strong>Desayuno</strong><b>{{ counts.breakfast }}</b></button>
      <button
        v-if="counts.lunch"
        type="button"
        class="attendance-type-switcher__option attendance-type-switcher__option--lunch"
        :class="{ 'is-active': modelValue === 'lunch' }"
        :aria-pressed="modelValue === 'lunch'"
        @click="emit('update:modelValue', 'lunch')"
      ><span><Utensils :size="17" /></span><strong>Comida</strong><b>{{ counts.lunch }}</b></button>
      <button
        v-if="counts.dinner"
        type="button"
        class="attendance-type-switcher__option attendance-type-switcher__option--dinner"
        :class="{ 'is-active': modelValue === 'dinner' }"
        :aria-pressed="modelValue === 'dinner'"
        @click="emit('update:modelValue', 'dinner')"
      ><span><Moon :size="17" /></span><strong>Cena</strong><b>{{ counts.dinner }}</b></button>
      <button
        v-if="counts.extendedTime"
        type="button"
        class="attendance-type-switcher__option attendance-type-switcher__option--extended"
        :class="{ 'is-active': modelValue === 'extendedTime' }"
        :aria-pressed="modelValue === 'extendedTime'"
        @click="emit('update:modelValue', 'extendedTime')"
      ><span><Timer :size="17" /></span><strong>Extendido</strong><b>{{ counts.extendedTime }}</b></button>
      <button
        v-if="counts.transport"
        type="button"
        class="attendance-type-switcher__option attendance-type-switcher__option--transport"
        :class="{ 'is-active': modelValue === 'transport' }"
        :aria-pressed="modelValue === 'transport'"
        @click="emit('update:modelValue', 'transport')"
      ><span><BusFront :size="17" /></span><strong>Transporte</strong><b>{{ counts.transport }}</b></button>
    </div>
  </div>
</template>
