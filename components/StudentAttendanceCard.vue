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
    <div class="student-card__main">
      <div class="student-avatar" aria-hidden="true">{{ initials }}</div>
      <div class="student-card__identity">
        <div class="student-card__title">
          <div>
            <h3>{{ student.name }}</h3>
            <p>{{ student.age !== null ? `${student.age} años` : 'Edad pendiente' }} · {{ student.plantel }} · Folio {{ student.folio }}</p>
          </div>
          <span class="attendance-dot" :title="student.attendance" />
        </div>

        <div class="student-card__chips">
          <span class="chip">{{ programLabel(student.program) }}</span>
          <span v-if="student.studentType" class="chip chip--neutral">{{ student.studentType }}</span>
          <span v-if="student.services.breakfast" class="chip chip--service"><Coffee :size="13" />Desayuno</span>
          <span v-if="student.services.lunch" class="chip chip--service"><Utensils :size="13" />Comida</span>
          <span v-if="student.services.dinner" class="chip chip--service"><Moon :size="13" />Cena</span>
          <span v-if="student.services.extendedTime" class="chip chip--service"><Timer :size="13" />Extendido</span>
          <span v-if="!serviceCount" class="chip chip--neutral">Sin servicios adicionales</span>
        </div>

        <div class="student-card__schedule">
          <Clock3 :size="15" />
          <span>{{ student.schedule.entry || '—' }}–{{ student.schedule.exit || '—' }}</span>
        </div>
      </div>

      <div class="attendance-actions">
        <button class="attendance-button attendance-button--absent" :class="{ 'is-active': student.attendance === 'absent' }" :disabled="busy" :aria-label="student.attendance === 'absent' ? 'Quitar ausencia' : 'Marcar ausente'" @click="emit('mark', student, 'absent')">
          <X :size="22" />
        </button>
        <button class="attendance-button attendance-button--present" :class="{ 'is-active': student.attendance === 'present' }" :disabled="busy" :aria-label="student.attendance === 'present' ? 'Quitar asistencia' : 'Marcar presente'" @click="emit('mark', student, 'present')">
          <Check :size="23" />
        </button>
      </div>
    </div>

    <details class="student-details">
      <summary><span>Ficha operativa</span><ChevronDown :size="18" /></summary>
      <div class="student-details__grid">
        <section>
          <h4><Phone :size="15" />Contacto principal</h4>
          <strong>{{ student.contacts.primary.name || 'Sin captura' }}</strong>
          <span>{{ student.contacts.primary.relation || 'Parentesco no indicado' }}</span>
          <a v-if="student.contacts.primary.phone" :href="phoneHref(student.contacts.primary.phone)">{{ student.contacts.primary.phone }}</a>
        </section>
        <section>
          <h4><Phone :size="15" />Contacto alterno</h4>
          <strong>{{ student.contacts.alternate.name || 'Sin captura' }}</strong>
          <span>{{ student.contacts.alternate.relation || 'Parentesco no indicado' }}</span>
          <a v-if="student.contacts.alternate.phone" :href="phoneHref(student.contacts.alternate.phone)">{{ student.contacts.alternate.phone }}</a>
        </section>
        <section v-if="student.allergies" class="student-detail-alert">
          <h4><AlertTriangle :size="15" />Alergias / información relevante</h4>
          <p>{{ student.allergies }}</p>
        </section>
        <section v-if="student.observations">
          <h4><IdCard :size="15" />Observaciones</h4>
          <p>{{ student.observations }}</p>
        </section>
      </div>
    </details>
  </article>
</template>
