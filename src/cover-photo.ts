import type { PhotoId } from './photos'

const orgPhotos: PhotoId[] = ['ladera-barrio-medellin', 'valle-aburra-panoramica', 'montanas-antioquia-verde', 'huerta-comunitaria-invernaderos', 'ladera-bruma-medellin', 'tejados-ladera']
/** Foto de ambiente (no es de la organización) para cabeceras sin portada propia; estable por semilla. */
export const photoFor = (seed: string): PhotoId => orgPhotos[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % orgPhotos.length]
