<script setup lang="ts">
import { AlertTriangle, Check, ChevronDown, Clock3, Coffee, IdCard, Moon, Phone, Timer, Utensils, X } from '@lucide/vue'
import { programLabel } from '~/shared/catalog'
import type { SummerStudent } from '~/types/summer'

const props = defineProps<{ student: SummerStudent; busy?: boolean }>()
const emit = defineEmits<{ mark: [student: SummerStudent, status: 'present' | 'absent'] }>()

const initials = computed(() => props.student.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase())
const phoneHref = (phone: string) => phone ? `tel:${phone.replace(/\D/g, '')}` : ''
const serviceCount = computed(() => Object.values(props.student.services).filter(Boolean).length)
</script>

<template>
  <article class="student-card" :class="`student-card--${student.attendance}`">
    <div class="student-card__body">
      <header class="student-card__header">
        <div class="student-avatar" aria-hidden="true">{{ initials }}</div>
        <div class="student-card__identity">
          <div class="student-card__name-row">
            <h3>{{ student.name }}</h3>
            <span class="attendance-dot" />
          </div>
          <p>{{ student.age !== null ? `${student.age} años` : 'Sin edad' }} <i /> {{ student.plantel }} <i /> #{{ student.folio }}</p>
        </div>
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
        <span v-if="!serviceCount" class="is-muted">Sin servicios</span>
      </div>
    </div>

    <div class="attendance-actions">
      <button
        class="attendance-button attendance-button--absent"
        :class="{ 'is-active': student.attendance === 'absent' }"
        :disabled="busy"
        @click="emit('mark', student, 'absent')"
      >
        <X :size="20" /><span>Ausente</span>
      </button>
      <button
        class="attendance-button attendance-button--present"
        :class="{ 'is-active': student.attendance === 'present' }"
        :disabled="busy"
        @click="emit('mark', student, 'present')"
      >
        <Check :size="20" /><span>Presente</span>
      </button>
    </div>

    <details class="student-details">
      <summary><span>Ficha</span><ChevronDown :size="18" /></summary>
      <div class="student-details__grid">
        <section>
          <h4><Phone :size="15" />Principal</h4>
          <strong>{{ student.contacts.primary.name || 'Sin captura' }}</strong>
          <span>{{ student.contacts.primary.relation || '—' }}</span>
          <a v-if="student.contacts.primary.phone" :href="phoneHref(student.contacts.primary.phone)">{{ student.contacts.primary.phone }}</a>
        </section>
        <section>
          <h4><Phone :size="15" />Alterno</h4>
          <strong>{{ student.contacts.alternate.name || 'Sin captura' }}</strong>
          <span>{{ student.contacts.alternate.relation || '—' }}</span>
          <a v-if="student.contacts.alternate.phone" :href="phoneHref(student.contacts.alternate.phone)">{{ student.contacts.alternate.phone }}</a>
        </section>
        <section v-if="student.allergies" class="student-detail-alert">
          <h4><AlertTriangle :size="15" />Alerta</h4>
          <p>{{ student.allergies }}</p>
        </section>
        <section v-if="student.observations">
          <h4><IdCard :size="15" />Notas</h4>
          <p>{{ student.observations }}</p>
        </section>
      </div>
    </details>
  </article>
</template>
