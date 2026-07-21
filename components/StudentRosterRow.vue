<script setup lang="ts">
import { AlertTriangle, Clock3, IdCard, Phone, UserRound } from '@lucide/vue'
import type { SummerStudent } from '~/types/summer'

const props = defineProps<{ student: SummerStudent; index: number }>()
const initials = computed(() => props.student.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase())
const phoneHref = (phone: string) => phone ? `tel:${phone.replace(/\D/g, '')}` : ''
</script>

<template>
  <details class="roster-row">
    <summary :aria-label="`Ver ficha de ${student.name}`">
      <span class="roster-row__number">{{ index + 1 }}</span>
      <span class="student-avatar student-avatar--small">{{ initials }}</span>
      <span class="roster-row__identity">
        <strong>{{ student.name }}</strong>
        <small>{{ student.age !== null ? `${student.age} años` : 'Sin edad' }} · {{ student.plantel }} · #{{ student.folio }}</small>
      </span>
      <span class="roster-row__schedule"><Clock3 :size="14" />{{ student.schedule.entry || '—' }}–{{ student.schedule.exit || '—' }}</span>
      <span class="roster-row__services"><StudentServiceLabels :services="student.services" :values="student.serviceValues" compact /></span>
      <span class="roster-row__chevron" aria-hidden="true">›</span>
    </summary>

    <div class="roster-row__details">
      <section>
        <small><UserRound :size="14" /> Contacto principal</small>
        <strong>{{ student.contacts.primary.name || 'Sin captura' }}</strong>
        <span>{{ student.contacts.primary.relation || '—' }}</span>
        <a v-if="student.contacts.primary.phone" :href="phoneHref(student.contacts.primary.phone)"><Phone :size="14" />{{ student.contacts.primary.phone }}</a>
      </section>
      <section>
        <small><UserRound :size="14" /> Contacto alterno</small>
        <strong>{{ student.contacts.alternate.name || 'Sin captura' }}</strong>
        <span>{{ student.contacts.alternate.relation || '—' }}</span>
        <a v-if="student.contacts.alternate.phone" :href="phoneHref(student.contacts.alternate.phone)"><Phone :size="14" />{{ student.contacts.alternate.phone }}</a>
      </section>
      <section :class="{ 'is-alert': student.allergies }">
        <small><AlertTriangle :size="14" /> Alergias / notas médicas</small>
        <strong>{{ student.allergies || 'Sin alertas registradas' }}</strong>
      </section>
      <section>
        <small><IdCard :size="14" /> Observaciones</small>
        <strong>{{ student.observations || 'Sin observaciones' }}</strong>
      </section>
    </div>
  </details>
</template>
