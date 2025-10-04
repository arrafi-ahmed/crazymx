<script setup>
import { getClientPublicImageUrl } from '@/others/util'
import { useDisplay } from 'vuetify'

const { xs } = useDisplay()

const scrollTo = (sectionId) => {
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<template>
  <v-container
    class="limit-max-width-xl fill-height landing"
    fluid
  >
    <!--    section 1-->
    <v-row
      :class="{
        'bg-mobile rounded-xl': xs,
        'bg-landing-color': !xs,
      }"
      align="center"
      class="rounded-xl"
      no-gutters
    >
      <v-col
        class="d-none d-sm-flex"
        cols="5"
      >
        <v-row no-gutters>
          <v-col cols="11">
            <v-img :src="getClientPublicImageUrl('landing1.png')" />
          </v-col>
        </v-row>
      </v-col>
      <v-col
        :class="{
          'bg-overlay-mobile text-white rounded-xl': xs,
        }"
        class="px-10"
        cols="12"
        md="7"
      >
        <v-row
          align="center"
          justify="center"
        >
          <v-col>
            <v-row
              class="mt-7 mt-md-0"
              justify="center"
            >
              <v-col
                :class="{ 'bg-overlay-mobile-logo rounded': xs }"
                cols="7"
                md="9"
              >
                <v-img
                  :src="getClientPublicImageUrl('logo.png')"
                  class="v-icon--clickable"
                  @click="$router.push({ name: 'signin' })"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col :class="{ 'text-center': xs }">
                <p class="pt-6 landing-text">
                  Click Event è la soluzione completa per la gestione dei vostri eventi. Semplifica
                  l'organizzazione, migliora l'efficienza e aumenta la soddisfazione dei clienti.
                </p>
                <p class="pt-8 landing-text">
                  Scoprite come rivoluzionare la gestione dei vostri eventi con la nostra
                  piattaforma intuitiva e potente.
                </p>
              </v-col>
            </v-row>
            <v-row
              align="center"
              class="pt-4"
              justify="center"
            >
              <v-col cols="auto">
                <v-btn
                  color="primary"
                  size="large"
                  @click.prevent="scrollTo('contact_section')"
                >
                  Contattaci
                </v-btn>
              </v-col>
            </v-row>

            <v-row
              align="center"
              class="py-4"
              justify="center"
            >
              <v-col cols="auto">
                <v-img
                  :src="getClientPublicImageUrl('landing2.png')"
                  :width="35"
                />
              </v-col>
              <v-col cols="auto">
                <small class="landing-text">by Ferdinando Guzzo Consulting</small>
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!--    section 2-->
    <v-row
      class="py-5 py-md-15"
      justify="center"
    >
      <v-col
        cols="12"
        sm="10"
      >
        <v-row justify="center">
          <v-col
            cols="12"
            sm="8"
          >
            <h1 class="landing-heading">
              Rivoluziona I Tuoi Eventi
            </h1>
            <v-row
              align="center"
              class="mt-2 mt-md-4"
              justify="center"
            >
              <v-col cols="12">
                <div id="contact_section">
                  <p class="landing-text">
                    Contattaci oggi per una demo gratuita e scopri come Click Event può trasformare
                    la gestione dei tuoi eventi. Semplifica, ottimizza e fai crescere il tuo
                    business con la nostra soluzione all-in-one.
                  </p>

                  <h3 class="mt-5 landing-heading">
                    Contatti
                  </h3>
                  <p class="landing-text">
                    Email:
                    <a
                      class="landing-link"
                      href="mailto:contact@clickevent.it"
                    >
                      ferdinandoguzzo@gmail.com
                    </a>
                    <br>
                    Telefono:
                    <a
                      class="landing-link"
                      href="tel:+393273471259"
                    >+393273471259</a>
                    <br>
                    Sito Web:
                    <a
                      class="landing-link"
                      href="http://www.clickevent.it"
                      target="_blank"
                    >
                      www.ferdinandoguzzo.it
                    </a>
                    <br>
                    Linkedin:
                    <a
                      class="landing-link"
                      href="https://www.linkedin.com/in/ferdinandoguzzo/"
                      target="_blank"
                    >
                      ferdinandoguzzo
                    </a>
                    <br>
                  </p>

                  <h3 class="mt-5 landing-heading">
                    Grazie Per L'Attenzione
                  </h3>
                  <p class="landing-text">
                    Siamo entusiasti di poter collaborare con voi per rendere i vostri eventi
                    indimenticabili. Non esitate a contattarci per qualsiasi domanda o per iniziare
                    subito con una prova gratuita.
                  </p>
                </div>
              </v-col>
            </v-row>
          </v-col>

          <v-col
            cols="12"
            order="first"
            order-sm="last"
            sm="3"
          >
            <v-img
              :src="getClientPublicImageUrl('landing6.png')"
              class="h-100 rounded"
              cover
            />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<style>
.bg-landing-color {
  background-color: rgb(var(--v-theme-surfaceVariant)) !important;
}

.bg-mobile {
  background: url('/img/landing1.png') !important;
  background-size: cover !important;
  position: relative !important;
}

.bg-overlay-mobile {
  background-color: rgba(0, 0, 0, 0.5) !important;
}

.bg-overlay-mobile-logo {
  background-color: rgba(255, 255, 255, 0.9) !important;
}

.landing,
.landing td {
  font-size: 1.2rem !important;
}

.landing-text {
  color: rgb(var(--v-theme-onSurface)) !important;
  font-size: 1.2rem !important;
}

.landing-heading {
  color: rgb(var(--v-theme-primary)) !important;
  font-weight: 600 !important;
}

.landing-link {
  color: rgb(var(--v-theme-secondary)) !important;
  text-decoration: none !important;
  font-weight: 500 !important;
}

.landing-link:hover {
  text-decoration: underline !important;
}

.v-card-title {
  font-size: 1.45rem !important;
  color: rgb(var(--v-theme-onSurface)) !important;
}

.v-card-text {
  font-size: 1.1rem !important;
  color: rgb(var(--v-theme-onSurface)) !important;
}
</style>
