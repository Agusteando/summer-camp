<script setup lang="ts">
import { ArrowLeft, Download, MapPin } from '@lucide/vue'
import { programLabel } from '~/shared/catalog'
import type { CampusName, ProgramScope } from '~/types/summer'

const props = defineProps<{
  campus: CampusName
  program: ProgramScope
  total: number
  exporting?: boolean
}>()

const emit = defineEmits<{
  back: []
  export: []
}>()
</script>

<template>
  <section class="scope-toolbar" aria-label="Grupo seleccionado">
    <div class="scope-toolbar__main">
      <div class="scope-toolbar__leading">
        <button class="scope-back-button scope-back-button--toolbar" type="button" title="Volver a modalidades" aria-label="Volver a modalidades" @click="emit('back')">
          <ArrowLeft :size="17" />
          <span>Atrás</span>
        </button>
        <div class="scope-toolbar__selection">
          <span class="scope-toolbar__icon"><MapPin :size="18" /></span>
          <div class="scope-toolbar__labels">
            <strong>{{ props.campus }}</strong>
            <span>{{ programLabel(props.program) }}</span>
          </div>
          <span class="scope-toolbar__count" :aria-label="`${props.total} alumnos`">{{ props.total }}</span>
        </div>
      </div>
      <div class="scope-toolbar__actions">
        <slot name="utility" />
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
