<script setup lang="ts">
import { AlertTriangle, Clock3, Coffee, Moon, Phone, Timer, Utensils } from '@lucide/vue'
import type { SummerStudent } from '~/types/summer'

const props = defineProps<{ student: SummerStudent; index: number }>()
const initials = computed(() => props.student.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase())
const phoneHref = (phone: string) => phone ? `tel:${phone.replace(/\D/g, '')}` : ''
const services = computed(() => [
  props.student.services.breakfast ? 'Desayuno' : '',
  props.student.services.lunch ? 'Comida' : '',
  props.student.services.dinner ? 'Cena' : '',
  props.student.services.extendedTime ? 'Extendido' : ''
].filter(Boolean))
</script>

<template>
  <details class="roster-row">
    <summary>
      <span class="roster-row__number">{{ index + 1 }}</span>
      <span class="student-avatar student-avatar--small">{{ initials }}</span>
      <span class="roster-row__identity">
        <strong>{{ student.name }}</strong>
        <small>{{ student.age !== null ? `${student.age} años` : 'Sin edad' }} · {{ student.plantel }} · #{{ student.folio }}</small>
      </span>
      <span class="roster-row__schedule"><Clock3 :size="14" />{{ student.schedule.entry || '—' }}–{{ student.schedule.exit || '—' }}</span>
      <span class="roster-row__services">{{ services.join(' · ') || 'Sin servicios' }}</span>
      <span class="roster-row__chevron" aria-hidden="true">›</span>
    </summary>

    <div class="roster-row__details">
      <section>
        <small>Contacto principal</small>
        <strong>{{ student.contacts.primary.name || 'Sin captura' }}</strong>
        <span>{{ student.contacts.primary.relation || '—' }}</span>
        <a v-if="student.contacts.primary.phone" :href="phoneHref(student.contacts.primary.phone)"><Phone :size="14" />{{ student.contacts.primary.phone }}</a>
      </section>
      <section>
        <small>Servicios</small>
        <div class="service-pills">
          <span v-if="student.services.breakfast"><Coffee :size="14" />Desayuno</span>
          <span v-if="student.services.lunch"><Utensils :size="14" />Comida</span>
          <span v-if="student.services.dinner"><Moon :size="14" />Cena</span>
          <span v-if="student.services.extendedTime"><Timer :size="14" />Extendido</span>
          <span v-if="!services.length">Sin servicios</span>
        </div>
      </section>
      <section :class="{ 'is-alert': student.allergies }">
        <small><AlertTriangle :size="14" /> Alergias / notas médicas</small>
        <strong>{{ student.allergies || 'Sin alertas registradas' }}</strong>
      </section>
      <section>
        <small>Observaciones</small>
        <strong>{{ student.observations || 'Sin observaciones' }}</strong>
      </section>
    </div>
  </details>
</template>
