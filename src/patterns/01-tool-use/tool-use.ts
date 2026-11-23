/**
 * PATRÓN: Uso de herramientas - Tool use
 * ---------------------------
 * El catálogo de cursos NO está en el entrenamiento
 * del modelo. Sin herramientas, el modelo inventa precios y cursos con
 * total confianza o en su defecto, no hace nada.
 * Con herramientas, consulta el dato real.
 */

import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { createTracer, model } from '../../helpers/index.js';

// ---------------------------------------------------------------------------
//  LA "BASE DE DATOS" — datos que el modelo no puede conocer
// ---------------------------------------------------------------------------

type Course = {
    id: string;
    title: string;
    hours: number;
    priceUSD: number;
    level: 'basic' | 'intermediate' | 'advanced';
    students: number;
};

const COURSE_CATALOG: Course[] = [
    {
        id: 'ts-01',
        title: 'TypeScript desde cero',
        hours: 22,
        priceUSD: 19.99,
        level: 'basic',
        students: 48_120,
    },
    {
        id: 'nest-02',
        title: 'NestJS: API REST modular',
        hours: 31,
        priceUSD: 24.99,
        level: 'intermediate',
        students: 22_450,
    },
    {
        id: 'flu-03',
        title: 'Flutter: apps multiplataforma',
        hours: 46,
        priceUSD: 29.99,
        level: 'intermediate',
        students: 61_300,
    },
    {
        id: 'agt-04',
        title: 'Agentes de IA con TypeScript',
        hours: 18,
        priceUSD: 34.99,
        level: 'advanced',
        students: 1_890,
    },
    {
        id: 'dkr-05',
        title: 'Docker para desarrolladores',
        hours: 14,
        priceUSD: 17.99,
        level: 'basic',
        students: 35_770,
    },
];

const QUESTION = "¿Cuánto costarian juntos el curso de TypeScript y el de Docker con un 20% de descuento? Dame también las horas totales";

async function withoutTools() {
    const tracer = createTracer('withoutTools');

    const { text } = await generateText({
        model: model,
        prompt: QUESTION,
        onStepEnd: tracer.onStepFinish
    });

    console.log("\nRespuesta withoutTools: " + text);
    return tracer.summary();
}

// ===============================================

const findCourses = tool({
    description:
        'Buscar cursos en el catálogo por texto, ' +
        'por titulo o por nivel. Utilizala siempre antes de responder ' +
        'cualquier pregunta sobre cursos, precios, cantidad de alumnos.',
    inputSchema: z.object({
        text: z.string().optional().describe('Texto a buscar en el título del curso'),
        level: z.enum(['basic', 'intermediate', 'advanced']).optional().describe('Nivel del curso')
    }),
    execute: ({ text, level }) => {
        const filteredCourses = COURSE_CATALOG.filter(course => {
            const matchesText = text ? course.title.toLowerCase().includes(text.toLowerCase()) : true;
            const matchesLevel = level ? course.level === level : true;
            return matchesText && matchesLevel;
        });

        return {
            found: filteredCourses.length > 0,
            courses: filteredCourses
        }
    }
});

const calculateTotal = tool({
    description: 'Calcula el precio total y las horas totales de un conjunto de cursos, aplicando un descuento opcional. Utilizala siempre antes de responder cualquier pregunta sobre precios y horas de cursos. No calcules mentalmente. ',
    inputSchema: z.object({
        ids: z.array(z.string()).describe('IDs de los cursos a sumar'),
        discount: z.number().min(0).max(100).default(0).optional().describe('Descuento a aplicar al precio total, en porcentaje (0-100)')
    }),
    execute: ({ ids, discount = 0 }) => {
        const selectedCourses = COURSE_CATALOG.filter(course => ids.includes(course.id));

        const notFound = ids.filter(id => !COURSE_CATALOG.some(course => course.id === id));

        const subTotal = selectedCourses.reduce(
            (acc, course) => acc + course.priceUSD, 0
        );

        const discountedPrice = subTotal * (discount / 100);

        return {
            discount: Number(discountedPrice.toFixed(2)),
            subtotal: Number(subTotal.toFixed(2)),
            total: Number((subTotal - discountedPrice).toFixed(2)),
            notFound,
        }
    }
});

async function withTools() {

    const tracer = createTracer('withTools');

    const { text } = await generateText({
        model: model,
        prompt: QUESTION,
        tools: {
            findCourses,
            calculateTotal,
        },
        stopWhen: stepCountIs(6),
        instructions: 'Eres un asistente que responde preguntas sobre cursos de programación. ' +
            'Antes de responder, siempre busca los cursos en el catálogo usando la herramienta findCourses. ' +
            'No inventes precios ni horas de cursos que no existan. ' +
            'Devuelve la respuesta en español.',
        onStepEnd: tracer.onStepFinish
    });

    console.log("\nRespuesta withTools: " + text);
    return tracer.summary();

}

export async function toolUseMain() {
    // const resultA = await withoutTools();
    const resultB = await withTools();

    console.log("\n=== Comparativa de resultados ===");

    console.table({
        //   'Respuesta withoutTools': resultA,
        'Respuesta withTools': resultB
    })
};