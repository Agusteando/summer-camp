<script setup lang="ts">
import { AlertTriangle, CalendarCheck2, Check, Clock3, Coffee, IdCard, Moon, Phone, Timer, Utensils, UserRound, X } from '@lucide/vue'
import { programLabel } from '~/shared/catalog'
import type { SummerStudent } from '~/types/summer'

const props = defineProps<{ student: SummerStudent }>()
const emit = defineEmits<{
  mark: [student: SummerStudent, status: 'present' | 'absent']
}>()

const initials = computed(() => props.student.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase())
const phoneHref = (phone: string) => phone ? `tel:${phone.replace(/\D/g, '')}` : ''
const lastUpdate = computed(() => props.student.attendanceUpdatedAt
  ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(props.student.attendanceUpdatedAt))
  : 'Sin registro hoy')
</script>

<template>
  <article class="student-inspector-card" :class="`student-inspector-card--${student.attendance}`">
    <div class="student-inspector-card__body">
      <header class="student-inspector-card__header">
        <span class="student-inspector-card__avatar">{{ initials }}</span>
        <div>
          <span class="student-inspector-card__eyebrow">Ficha del alumno</span>
          <h2>{{ student.name }}</h2>
          <p>{{ student.age !== null ? `${student.age} años` : 'Sin edad' }} <i /> {{ student.plantel }} <i /> #{{ student.folio }}</p>
        </div>
        <span class="attendance-dot" />
      </header>

      <div class="student-card__meta">
        <span class="program-chip">{{ programLabel(student.program) }}</span>
        <span v-if="student.studentType" class="type-chip">{{ student.studentType }}</span>
        <span class="schedule-chip"><Clock3 :size="14" />{{ student.schedule.entry || '—' }}–{{ student.schedule.exit || '—' }}</span>
      </div>

      <div class="student-card__services">
        <span v-if="student.services.breakfast"><Coffee :size="14" />Desayuno</span>
        <span v-if="student.services.lunch"><Utensils :size="14" />Comida</span>
        <span v-if="student.services.dinner"><Moon :size="14" />Cena</span>
        <span v-if="student.services.extendedTime"><Timer :size="14" />Extendido</span>
      </div>
    </div>

    <div class="attendance-actions attendance-actions--inspector">
      <button class="attendance-button attendance-button--absent" :class="{ 'is-active': student.attendance === 'absent' }" @click="emit('mark', student, 'absent')">
        <X :size="19" /><span>Ausente</span>
      </button>
      <button class="attendance-button attendance-button--present" :class="{ 'is-active': student.attendance === 'present' }" @click="emit('mark', student, 'present')">
        <Check :size="19" /><span>Presente</span>
      </button>
    </div>

    <div class="student-inspector-card__details">
      <section>
        <span><UserRound :size="18" /></span>
        <div><small>Padre / Tutor</small><strong>{{ student.contacts.primary.name || 'Sin captura' }}</strong><em>{{ student.contacts.primary.relation }}</em></div>
      </section>
      <section>
        <span><Phone :size="18" /></span>
        <div><small>Teléfono</small><a v-if="student.contacts.primary.phone" :href="phoneHref(student.contacts.primary.phone)">{{ student.contacts.primary.phone }}</a><strong v-else>Sin captura</strong></div>
      </section>
      <section>
        <span><AlertTriangle :size="18" /></span>
        <div><small>Notas médicas</small><strong>{{ student.allergies || 'Sin alertas registradas' }}</strong></div>
      </section>
      <section>
        <span><IdCard :size="18" /></span>
        <div><small>Observaciones</small><strong>{{ student.observations || 'Sin observaciones' }}</strong></div>
      </section>
      <section>
        <span><CalendarCheck2 :size="18" /></span>
        <div><small>Última actualización</small><strong>{{ lastUpdate }}</strong></div>
      </section>
    </div>
  </article>
</template>
