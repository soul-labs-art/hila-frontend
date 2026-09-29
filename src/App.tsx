import './App.css'

function App() {
  return (
    <div className="site-shell" id="inicio">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Hila, inicio">
          <img src="/brand/hila-wordmark-delgado.png" alt="" />
        </a>

        <nav className="main-nav" aria-label="Navegación principal">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#personas">Personas</a>
          <a href="#organizaciones">Organizaciones</a>
        </nav>

        <a className="header-link" href="#estado">
          Estado del piloto
        </a>
      </header>

      <main id="contenido" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="hero-location">
              <span className="location-mark" aria-hidden="true" />
              Piloto en preparación · Medellín y Valle de Aburrá
            </p>
            <h1 id="hero-title">Lo que sabes hacer puede encontrar dónde hace falta.</h1>
            <p className="hero-description">
              Hila acerca las capacidades de las personas a necesidades concretas de organizaciones y colectivos comunitarios.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#como-funciona">
                Conoce el proceso
              </a>
              <a className="hero-text-link" href="#personas">
                Quiénes participan
              </a>
            </div>
          </div>

          <figure className="hero-brand">
            <img
              className="hero-brand-mark"
              src="/brand/hila-emblema.png"
              alt="Emblema de Hila: manos que sostienen una chispa, rodeadas de hojas."
            />
          </figure>
        </section>

        <section className="process-section content-width" id="como-funciona" aria-labelledby="process-title">
          <div className="section-intro">
            <p className="section-kicker">Una colaboración con acuerdos claros</p>
            <h2 id="process-title">Del primer encuentro a una acción que deja huella.</h2>
            <p>
              Hila ordena la información para que cada parte sepa qué aportar, qué esperar y cómo cerrar la actividad.
            </p>
          </div>

          <ol className="process-steps">
            <li>
              <span className="step-index" aria-hidden="true">01</span>
              <h3>Se describe la necesidad</h3>
              <p>La organización explica la actividad, el horario, el lugar y las capacidades que necesita.</p>
            </li>
            <li>
              <span className="step-index" aria-hidden="true">02</span>
              <h3>Se encuentran capacidades</h3>
              <p>Las personas comparten lo que saben hacer y revisan coincidencias con cada oportunidad.</p>
            </li>
            <li>
              <span className="step-index" aria-hidden="true">03</span>
              <h3>Se acuerda y se aprende</h3>
              <p>La organización y la persona confirman el compromiso y registran juntas lo que ocurrió.</p>
            </li>
          </ol>
        </section>

        <section className="people-section content-width" aria-label="Formas de participar">
          <article className="audience-row" id="personas">
            <div className="audience-heading">
              <p className="section-kicker">Para personas</p>
              <h2>Tus saberes también cuentan.</h2>
            </div>
            <div className="audience-copy">
              <p>
                Puedes aportar tiempo, conocimientos, oficios o recursos. Tu perfil es independiente del registro de cualquier organización.
              </p>
              <p className="audience-note">Puedes prepararlo aunque todavía no haya oportunidades publicadas.</p>
            </div>
          </article>

          <article className="audience-row" id="organizaciones">
            <div className="audience-heading">
              <p className="section-kicker">Para organizaciones</p>
              <h2>Convoca desde tu territorio.</h2>
            </div>
            <div className="audience-copy">
              <p>
                Organizaciones formales y colectivos pueden describir lo que necesitan y acompañar cada compromiso hasta su cierre.
              </p>
              <p className="audience-note">Un colectivo puede solicitar revisión sin NIT ni personería jurídica.</p>
            </div>
          </article>
        </section>

        <section className="pilot-section" id="estado" aria-labelledby="pilot-title">
          <div className="pilot-inner content-width">
            <div>
              <p className="section-kicker">Hila está preparando su piloto</p>
              <h2 id="pilot-title">Las primeras oportunidades se abrirán con organizaciones del territorio.</h2>
            </div>
            <p className="pilot-note">
              El registro y las convocatorias todavía no están habilitados. Estamos construyendo la plataforma para probarla en Medellín y el Valle de Aburrá.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer content-width">
        <a className="footer-brand" href="#inicio" aria-label="Hila, volver al inicio">
          <img src="/brand/hila-wordmark-delgado.png" alt="" />
        </a>
        <p>Una red para que el apoyo llegue con claridad y cuidado.</p>
        <a href="#inicio">Volver al inicio</a>
      </footer>
    </div>
  )
}

export default App
