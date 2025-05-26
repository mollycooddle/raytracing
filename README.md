	#Общий алгоритм работы
1. Инициализируется камера, сцена и материалы
2. Для каждого фрагмента генерируется первичный луч из камеры
3. Луч проверяется на пересечение со всеми объектами сцены
4. Для ближайшего пересечения вычисляется освещение по модели Фонга
5. В зависимости от материала объекта генерируются:
	5.1 Отражённые лучи для зеркальных поверхностей
	5.2 Преломлённые лучи для прозрачных материалов
6. Эти лучи добавляются в стек для дальнейшей обработки
7. Цикл продолжается, пока стек не опустеет или не будет достигнута максимальная глубина рекурсии
8. Все вклады лучей суммируются для получения итогового цвета пикселя
Код реализует рекурсивную трассировку лучей с использованием стека (чтобы избежать ограничений на рекурсию в GLSL), 
поддерживает зеркальные отражения, преломление света и мягкие тени.
	
	
#version 430
#define EPSILON 0.001		//маленькое значение для избежания self-intersection (артефактов при отражениях)
#define BIG 1000000.0		//большое число для представления "бесконечности"

		//Константы определяют типы материалов и максимальную глубину рекурсии/размер стека
const int DIFFUSE = 1;
const int REFLECTION = 2;
const int REFRACTION = 3;
const int DIFFUSE_REFLECTION = 1; 
const int MIRROR_REFLECTION = 2;
const int MAX_DEPTH = 5;
const int MAX_STACK = 50;


float Unit = 1.0;		//единичное значение для вычислений
float contribution = 1.0;		//начальный вклад луча в итоговый цвет


		//сфера(центр, радиус, материал)
struct SSphere {
    vec3 Center;
    float Radius;
    int MaterialIdx;
};

		//треугольник(вершины, материал)
struct STriangle {
    vec3 v1;
    vec3 v2;
    vec3 v3;
    int MaterialIdx;
};

		//камера(позиция, направление взгляда, вектор вверх, вектор вправо, масштаб для преобразования координат)
struct SCamera {
    vec3 Position;
    vec3 View;
    vec3 Up;
    vec3 Side;
    vec2 Scale;
};

		//луч(начало луча, направление(нормализованное))
struct SRay {
    vec3 Origin;
    vec3 Direction;
};

		//информация о пересечении(параметр пересечения(расстояние), точка пересечения, нормаль в точке, цвет материала, 
		//	коэффициенты освещения(ambient, diffuse, specular, shininess), коэф. отражения, коэф. преломления, прозрачность, материал)
struct SIntersection { 
    float Time; 
    vec3 Point; 
    vec3 Normal; 
    vec3 Color;
    vec4 LightCoeffs; 
    float ReflectionCoef; 
    float RefractionCoef; 
    float Transparency;
    int MaterialType; 
}; 

		//материал(цвет, коэф. освещения, коэф отражения, коэф. преломления, прозрачность, id материала)
struct SMaterial { 
    vec3 Color; 
    vec4 LightCoeffs; 
    float ReflectionCoef; 
    float RefractionCoef; 
    float Transparency;
    int MaterialType; 
}; 

		//источник света(позиция)
struct SLight { 
    vec3 Position; 
}; 

		//луч для трассировки(луч, вклад в итоговый цвет, глубина рекурсии)
struct STracingRay 
{ 
    SRay ray; 
    float contribution; 
    int depth; 
}; 

STriangle triangles[12];  // Массив треугольников
SSphere spheres[4];       // Массив сфер
SMaterial materials[6];   // Массив материалов
SCamera uCamera;          // Камера
SLight uLight;            // Источник света
STracingRay rayStack[MAX_STACK]; // Стек для лучей
int stackTop = 0;         // Вершина стека

out vec4 FragColor;       // Выходной цвет фрагмента
in vec3 glPosition;       // Входные координаты фрагмента


		//Реализация стека для лучей(добавить, удалить, проверить на пустоту)
void pushRay(STracingRay trRay) {
    if (stackTop < MAX_STACK)
        rayStack[stackTop++] = trRay;
}

STracingRay popRay() {
    return rayStack[--stackTop];
}

bool isEmpty() {
    return stackTop == 0;
}

		//Генерация луча
		//Функция создаёт луч из позиции камеры через текущий пиксель:
		//	1. Масштабирует координаты фрагмента
		//	2. Вычисляет направление как комбинацию базовых векторов камеры
		//	3. Возвращает нормализованный луч
SRay GenerateRay(SCamera uCamera) {
    vec2 coords = glPosition.xy * uCamera.Scale;
    vec3 direction = uCamera.View + uCamera.Side * coords.x + uCamera.Up * coords.y;
    return SRay(uCamera.Position, normalize(direction));
}

		//Инициализация сцены
		//	Устанавливает камеру в (0,0,-8), смотрит вдоль Z, up по Y
SCamera initializeDefaultCamera() {
    SCamera camera;
    camera.Position = vec3(0.0, 0.0, -8.0);
    camera.View = vec3(0.0, 0.0, 1.0);
    camera.Up = vec3(0.0, 1.0, 0.0);
    camera.Side = vec3(1.0, 0.0, 0.0);
    camera.Scale = vec2(1.0, 1.0);
    return camera;
}

		//	Создаёт 12 треугольников (стены комнаты) и 4 сферы
void initializeDefaultScene() {
    triangles[0].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[0].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[0].v3 = vec3(-5.0, 5.0, -5.0);
    triangles[0].MaterialIdx = 2;

    triangles[1].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[1].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[1].v3 = vec3(-5.0, 5.0, 5.0);
    triangles[1].MaterialIdx = 2;

    triangles[2].v1 = vec3(5.0, -5.0, 5.0);
    triangles[2].v2 = vec3(5.0, -5.0, -5.0);
    triangles[2].v3 = vec3(5.0, 5.0, -5.0);
    triangles[2].MaterialIdx = 2;

    triangles[3].v1 = vec3(5.0, -5.0, 5.0);
    triangles[3].v2 = vec3(5.0, 5.0, -5.0);
    triangles[3].v3 = vec3(5.0, 5.0, 5.0);
    triangles[3].MaterialIdx = 2;

    triangles[6].v1 = vec3(-5.0, -5.0, 5.0);
    triangles[6].v2 = vec3(5.0, 5.0, 5.0);
    triangles[6].v3 = vec3(5.0, -5.0, 5.0);
    triangles[6].MaterialIdx = 2;

    triangles[7].v1 = vec3(-5.0, -5.0, 5.0);
    triangles[7].v2 = vec3(-5.0, 5.0, 5.0);
    triangles[7].v3 = vec3(5.0, 5.0, 5.0);
    triangles[7].MaterialIdx = 2;

    triangles[8].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[8].v2 = vec3(5.0, -5.0, 5.0);
    triangles[8].v3 = vec3(5.0, -5.0, -5.0);
    triangles[8].MaterialIdx = 4;

    triangles[9].v1 = vec3(-5.0, -5.0, -5.0);
    triangles[9].v2 = vec3(-5.0, -5.0, 5.0);
    triangles[9].v3 = vec3(5.0, -5.0, 5.0);
    triangles[9].MaterialIdx = 4;

    triangles[10].v1 = vec3(-5.0, 5.0, -5.0);
    triangles[10].v2 = vec3(5.0, 5.0, -5.0);
    triangles[10].v3 = vec3(5.0, 5.0, 5.0);
    triangles[10].MaterialIdx = 3;

    triangles[11].v1 = vec3(-5.0, 5.0, -5.0);
    triangles[11].v2 = vec3(5.0, 5.0, 5.0);
    triangles[11].v3 = vec3(-5.0, 5.0, 5.0);
    triangles[11].MaterialIdx = 3;

    spheres[0].Center = vec3(-1.0, -1.0, -2.0);
    spheres[0].Radius = 2.0;
    spheres[0].MaterialIdx = 1;

    spheres[1].Center = vec3(2.0, 1.0, 2.0);
    spheres[1].Radius = 1.0;
    spheres[1].MaterialIdx = 1;

    spheres[2].Center = vec3(-2.0, 3.0, 3.0);
    spheres[2].Radius = 1.0;
    spheres[2].MaterialIdx = 0;


    spheres[3].Center = vec3(3.0, -3.0, -3.0);
    spheres[3].Radius = 2.0;
    spheres[3].MaterialIdx = 0;
}

		// Создаёт источник света и 6 материалов:
		// 0 - преломляющий (зелёный)
		// 1 - зеркальный (белый)
		// 2-5 - диффузные (разных цветов)
void initializeDefaultLightMaterials(out SLight light, out SMaterial materials[6]) {
    light.Position = vec3(0.0, 2.0, -4.0f);

    vec4 lightCoefs = vec4(0.4, 0.9, 0.0, 512.0);
    materials[0].Color = vec3(0.0, 1.0, 0.0);
    materials[0].LightCoeffs = lightCoefs;
    materials[0].ReflectionCoef = 0.0;
    materials[0].RefractionCoef = 1.0;
    materials[0].Transparency = 1.25;
    materials[0].MaterialType = REFRACTION;

    materials[1].Color = vec3(1.0, 1.0, 1.0);
    materials[1].LightCoeffs = lightCoefs;
    materials[1].ReflectionCoef = 1.0;
    materials[1].RefractionCoef = 0.0;
    materials[1].Transparency = 1.0; 
    materials[1].MaterialType = MIRROR_REFLECTION;

    materials[2] = SMaterial(vec3(1.0), lightCoefs, 0.0, 1.0, 1.0, DIFFUSE);
    materials[3] = SMaterial(vec3(1.0, 0.0, 0.0), lightCoefs, 0.0, 1.0, 1.0, DIFFUSE);
    materials[4] = SMaterial(vec3(0.0, 0.0, 1.0), lightCoefs, 0.0, 1.0, 1.0, DIFFUSE);
    materials[5] = SMaterial(vec3(1.0, 0.0, 1.0), lightCoefs, 0.0, 1.0, 1.0, DIFFUSE);
}

		//Пересечение луча со сферой
bool IntersectSphere(SSphere sphere, SRay ray, float start, float final, out float time) {
    ray.Origin -= sphere.Center;		// Переносим начало луча в систему координат сферы
	
		// Квадратное уравнение: A*t² + B*t + C = 0
    float A = dot(ray.Direction, ray.Direction);
    float B = dot(ray.Direction, ray.Origin);
    float C = dot(ray.Origin, ray.Origin) - sphere.Radius * sphere.Radius;
    float D = B * B - A * C;		// Дискриминант
    if (D > 0.0) {
        D = sqrt(D);
        float t1 = (-B - D) / A;
        float t2 = (-B + D) / A;
			
				// Выбираем ближайшее пересечение в допустимом диапазоне
        if (t1 < 0 && t2 < 0)
            return false;
        if (min(t1, t2) < 0) {
            time = max(t1, t2);
            return true;
        }
        time = min(t1, t2);
        return true;
    }
    return false;
}

		//Пересечение луча с треугольником
bool IntersectTriangle(SRay ray, vec3 v1, vec3 v2, vec3 v3, out float time) {
    time = -1.0;
    vec3 A = v2 - v1;
    vec3 B = v3 - v1;
    vec3 N = cross(A, B);		// Нормаль к треугольнику
    float NdotRay = dot(N, ray.Direction);
    if (abs(NdotRay) < 0.001)		// Луч параллелен плоскости
        return false;
		
			// Находим параметр пересечения с плоскостью
    float d = dot(N, v1);
    float t = -(dot(N, ray.Origin) - d) / NdotRay;
    if (t < 0.0)
        return false;
		
			// Точка пересечения с плоскостью
    vec3 P = ray.Origin + t * ray.Direction;

			// Проверка, что точка внутри треугольника (методом ориентации)
    vec3 edge1 = v2 - v1;
    vec3 VP1 = P - v1;
    vec3 C = cross(edge1, VP1);
    if (dot(N, C) < 0.0) return false;

    vec3 edge2 = v3 - v2;
    vec3 VP2 = P - v2;
    C = cross(edge2, VP2);
    if (dot(N, C) < 0.0) return false;

    vec3 edge3 = v1 - v3;
    vec3 VP3 = P - v3;
    C = cross(edge3, VP3);
    if (dot(N, C) < 0.0) return false;

    time = t;
    return true;
}

		//Основная функция трассировки
bool Raytrace(SRay ray, SSphere spheres[4], STriangle triangles[12], SMaterial materials[6], float start, float final, inout SIntersection intersect) {
    bool result = false;
    intersect.Time = final;

		// Проверяем пересечения со сферами
    for (int i = 0; i < 4; i++) {
        float t;
        if (IntersectSphere(spheres[i], ray, start, final, t) && t < intersect.Time) {
            intersect.Time = t;
            intersect.Point = ray.Origin + ray.Direction * t;
            intersect.Normal = normalize(intersect.Point - spheres[i].Center);
            int mtlIdx = spheres[i].MaterialIdx;

				// Заполняем свойства материала
            intersect.Color = materials[mtlIdx].Color;
            intersect.LightCoeffs = materials[mtlIdx].LightCoeffs;
            intersect.ReflectionCoef = materials[mtlIdx].ReflectionCoef;
            intersect.RefractionCoef = materials[mtlIdx].RefractionCoef;
            intersect.Transparency = materials[mtlIdx].Transparency;         
            intersect.MaterialType = materials[mtlIdx].MaterialType;

            result = true;
        }
    }

			// Проверяем пересечения с треугольниками (аналогично)
    for (int i = 0; i < 12; i++) {
        float t;
        if (IntersectTriangle(ray, triangles[i].v1, triangles[i].v2, triangles[i].v3, t) && t < intersect.Time) {
            intersect.Time = t;
            intersect.Point = ray.Origin + ray.Direction * t;
            intersect.Normal = normalize(cross(triangles[i].v1 - triangles[i].v2, triangles[i].v3 - triangles[i].v2));
            int mtlIdx = triangles[i].MaterialIdx;


            intersect.Color = materials[mtlIdx].Color;
            intersect.LightCoeffs = materials[mtlIdx].LightCoeffs;
            intersect.ReflectionCoef = materials[mtlIdx].ReflectionCoef;
            intersect.RefractionCoef = materials[mtlIdx].RefractionCoef;
            intersect.Transparency = materials[mtlIdx].Transparency;        
            intersect.MaterialType = materials[mtlIdx].MaterialType;

            result = true;
        }
    }

    return result;
}


		//Тени
float Shadow(SLight currLight, SIntersection intersect) {
    float shadowing = 1.0;
    vec3 direction = normalize(currLight.Position - intersect.Point);
    float distanceLight = distance(currLight.Position, intersect.Point);
    
			// Луч от точки пересечения к свету
	SRay shadowRay = SRay(intersect.Point + direction * EPSILON, direction);
    SIntersection shadowIntersect;
    shadowIntersect.Time = BIG;

			// Если есть пересечение между точкой и светом - тень
    if (Raytrace(shadowRay, spheres, triangles, materials, 0.0, distanceLight, shadowIntersect)) {
        shadowing = 0.0;
    }

    return shadowing;
}

		//Модель освещения Фонга
vec3 Phong(SIntersection intersect, SLight currLight, float shadowing) {
    vec3 light = normalize(currLight.Position - intersect.Point);
    float diffuse = max(dot(light, intersect.Normal), 0.0);		// Диффузная составляющая
    vec3 view = normalize(uCamera.Position - intersect.Point);
    vec3 reflected = reflect(-view, intersect.Normal);			// Отражённый вектор
    float specular = pow(max(dot(reflected, light), 0.0), intersect.LightCoeffs.w);		// Блик
    
			// Комбинируем компоненты:
	return intersect.LightCoeffs.x * intersect.Color +									// Ambient
           intersect.LightCoeffs.y * diffuse * intersect.Color * shadowing +			// Diffuse
           intersect.LightCoeffs.z * specular * Unit;									// Specular
}

		//Основная функция шейдера
void main(void)
{
    float start = 0.0;
    float final = BIG;

			// Инициализация сцены
    uCamera = initializeDefaultCamera();
    initializeDefaultScene();
    initializeDefaultLightMaterials(uLight, materials);

			// Генерация первичного луча
    SRay ray = GenerateRay(uCamera);
    vec3 resultColor = vec3(0.0);

			// Помещаем первичный луч в стек
    STracingRay trRay = STracingRay(ray, 1.0, 0);
    pushRay(trRay);

			// Основной цикл трассировки
    while (!isEmpty()) {
        trRay = popRay();
        ray = trRay.ray;

        SIntersection intersect;
        intersect.Time = BIG;
			
			// Пропускаем лучи с малым вкладом или слишком глубокой рекурсией
        if (trRay.contribution < 0.01 || trRay.depth > MAX_DEPTH)
            continue;
	
			// Если есть пересечение
        if (Raytrace(ray, spheres, triangles, materials, start, final, intersect)) {
					// Вычисляем тени и локальное освещение
			float shadowing = Shadow(uLight, intersect);
            vec3 localColor = Phong(intersect, uLight, shadowing);
            resultColor += localColor * trRay.contribution;

            vec3 newOrigin = intersect.Point + intersect.Normal * EPSILON;

					// Обработка отражений и преломлений
            if (intersect.MaterialType == MIRROR_REFLECTION) {
					// Генерируем отражённый луч
                vec3 reflectedDir = reflect(ray.Direction, intersect.Normal);
                SRay reflectedRay = SRay(newOrigin, reflectedDir);
                pushRay(STracingRay(reflectedRay, trRay.contribution * intersect.ReflectionCoef, trRay.depth + 1));
            } else if (intersect.MaterialType == REFRACTION) {
					// Преломление по закону Снелла
                vec3 n = intersect.Normal;
                float eta = intersect.RefractionCoef;
                float cosi = dot(ray.Direction, n);
                float etai = 1.0, etat = eta;
					// Определяем направление нормали
				if (cosi > 0.0) {		// Луч внутри объекта
                    n = -n;
                    etai = eta;
                    etat = 1.0;
                } else {
                    cosi = -cosi;
                }
                float etaRatio = etai / etat;
                float k = 1.0 - etaRatio * etaRatio * (1.0 - cosi * cosi);

                if (k >= 0.0) {			// Если нет полного внутреннего отражения
                    vec3 refractedDir = normalize(etaRatio * ray.Direction + (etaRatio * cosi - sqrt(k)) * n);
                    vec3 refractedOrigin = intersect.Point - n * EPSILON;
                    pushRay(STracingRay(SRay(refractedOrigin, refractedDir), trRay.contribution * intersect.Transparency, trRay.depth + 1));
                }
					
						// Всегда добавляем отражённый луч (даже при преломлении)
                vec3 reflectedDir = reflect(ray.Direction, intersect.Normal);
                pushRay(STracingRay(SRay(newOrigin, reflectedDir), trRay.contribution * intersect.ReflectionCoef, trRay.depth + 1));
            }
        }
    }

    FragColor = vec4(resultColor, 1.0);
}
