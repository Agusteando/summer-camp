<script setup lang="ts">
import { Download, MapPin, Pencil, RotateCcw } from '@lucide/vue'
import { programLabel } from '~/shared/catalog'
import type { CampusName, ProgramScope } from '~/types/summer'

const props = defineProps<{
  campus: CampusName
  program: ProgramScope
  total: number
  exporting?: boolean
}>()

const emit = defineEmits<{
  edit: []
  reset: []
  export: []
}>()
</script>

<template>
  <section class="scope-toolbar">
    <div class="scope-toolbar__selection">
      <span class="scope-toolbar__icon"><MapPin :size="20" /></span>
      <div><small>Trabajando con</small><strong>{{ props.campus }} · {{ programLabel(props.program) }}</strong></div>
      <span class="scope-toolbar__count">{{ props.total }}</span>
    </div>
    <div class="scope-toolbar__actions">
      <button class="secondary-button scope-toolbar__edit" type="button" aria-label="Cambiar campus o modalidad" @click="emit('edit')"><Pencil :size="16" /><span>Cambiar</span></button>
      <button class="secondary-button secondary-button--icon" type="button" aria-label="Reiniciar selección" @click="emit('reset')"><RotateCcw :size="16" /></button>
      <button class="primary-button" type="button" :disabled="exporting || !total" @click="emit('export')">
        <Download :size="17" /> {{ exporting ? 'Preparando…' : 'Excel' }}
      </button>
    </div>
  </section>
</template>
