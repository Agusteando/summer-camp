<script setup lang="ts">
import { Download, MapPin, RotateCcw } from '@lucide/vue'
import { programLabel } from '~/shared/catalog'
import type { CampusName, ProgramScope } from '~/types/summer'

const props = defineProps<{
  campus: CampusName
  program: ProgramScope
  total: number
  exporting?: boolean
}>()

const emit = defineEmits<{
  reset: []
  export: []
}>()
</script>

<template>
  <section class="scope-toolbar" aria-label="Grupo seleccionado">
    <div class="scope-toolbar__main">
      <div class="scope-toolbar__selection">
        <span class="scope-toolbar__icon"><MapPin :size="18" /></span>
        <div class="scope-toolbar__labels">
          <strong>{{ props.campus }}</strong>
          <span>{{ programLabel(props.program) }}</span>
        </div>
        <span class="scope-toolbar__count" :aria-label="`${props.total} alumnos`">{{ props.total }}</span>
      </div>
      <div class="scope-toolbar__actions">
        <slot name="utility" />
        <button class="secondary-button secondary-button--icon" type="button" title="Reiniciar selección" aria-label="Reiniciar selección" @click="emit('reset')">
          <RotateCcw :size="16" />
        </button>
        <button class="primary-button" type="button" :disabled="exporting || !total" @click="emit('export')">
          <Download :size="17" /><span>{{ exporting ? 'Preparando…' : 'Excel' }}</span>
        </button>
      </div>
    </div>
    <div v-if="$slots.context" class="scope-toolbar__context">
      <slot name="context" />
    </div>
  </section>
</template>
